// 伯乐模拟器 - macOS ScreenCaptureKit 原生音频捕获 helper
//
// 用 ScreenCaptureKit 捕获系统音频（PCM 48kHz 立体声），
// 下采样为 16kHz 单声道 WAV，每 N 秒写一个文件，stdout 打印路径。
//
// 关键点：ScreenCaptureKit 捕获系统输出流，不激活录音会话（不经过输入设备），
// 因此蓝牙耳机保持 A2DP 高音质，不会切到 HFP 通话模式。
//
// 用法：bole-capture --out <目录> [--sec 15]
// 输出：每 --sec 秒写一个 chunk_N.wav，stdout 打印 "CHUNK:<path>"

import ScreenCaptureKit
import AVFoundation
import Foundation

// ============================================================
// 命令行参数解析
// ============================================================

var outDir = NSTemporaryDirectory()
var chunkSec = 15.0

let rawArgs = CommandLine.arguments
var ai = 1
while ai < rawArgs.count {
    switch rawArgs[ai] {
    case "--out":
        if ai + 1 < rawArgs.count { outDir = rawArgs[ai + 1]; ai += 1 }
    case "--sec":
        if ai + 1 < rawArgs.count { chunkSec = Double(rawArgs[ai + 1]) ?? 15.0; ai += 1 }
    default:
        break
    }
    ai += 1
}

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

// ============================================================
// WAV 写入（16kHz 单声道 s16le）
// ============================================================

func writeWav(_ pcm: [Int16], to path: String) {
    let sampleRate: UInt32 = 16000
    let channels: UInt16 = 1
    let bitsPerSample: UInt16 = 16
    let dataSize = UInt32(pcm.count * 2)
    let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample) / 8
    let blockAlign = channels * bitsPerSample / 8

    var header = Data()
    func appendStr(_ s: String) { header.append(s.data(using: .ascii)!) }
    func appendU32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { header.append(contentsOf: $0) } }
    func appendU16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { header.append(contentsOf: $0) } }

    appendStr("RIFF")
    appendU32(36 + dataSize)
    appendStr("WAVE")
    appendStr("fmt ")
    appendU32(16)
    appendU16(1)                    // PCM
    appendU16(channels)
    appendU32(sampleRate)
    appendU32(byteRate)
    appendU16(blockAlign)
    appendU16(bitsPerSample)
    appendStr("data")
    appendU32(dataSize)

    var body = Data()
    body.reserveCapacity(pcm.count * 2)
    for s in pcm {
        withUnsafeBytes(of: s.littleEndian) { body.append(contentsOf: $0) }
    }

    do {
        try (header + body).write(to: URL(fileURLWithPath: path))
    } catch {
        FileHandle.standardError.write("ERROR: write wav failed: \(error.localizedDescription)\n".data(using: .utf8)!)
    }
}

// ============================================================
// 捕获管理
// ============================================================

final class CaptureManager: NSObject, SCStreamOutput, SCStreamDelegate {
    private var stream: SCStream?
    private let queue = DispatchQueue(label: "bole.capture.audio")
    private var pendingFrames: [Int16] = []   // 48k stereo 原始帧（L,R 交错）
    private var monoBuffer: [Int16] = []      // 16k mono 累积（当前 chunk）
    private var chunkIndex = 0
    private let chunkTarget: Int               // 每个 chunk 的 16k mono 采样数
    private let targetPerFrame: Int = 16000    // 目标采样率

    override init() {
        chunkTarget = Int(chunkSec * 16000)
        super.init()
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else {
            FileHandle.standardError.write("ERROR: no display found\n".data(using: .utf8)!)
            exit(1)
        }

        let config = SCStreamConfiguration()
        config.width = Int(display.width)
        config.height = Int(display.height)
        config.showsCursor = false
        config.capturesAudio = true
        config.sampleRate = 48000
        config.channelCount = 2
        config.queueDepth = 8

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let s = SCStream(filter: filter, configuration: config, delegate: self)
        try s.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
        try await s.startCapture()
        stream = s
        FileHandle.standardOutput.write("READY\n".data(using: .utf8)!)
    }

    func stop() {
        FileHandle.standardError.write("STOP requested (buffered \(monoBuffer.count) samples)\n".data(using: .utf8)!)
        // 最后不足一 chunk 的音频也写出（大于 2 秒才有识别价值）
        if monoBuffer.count >= 16000 * 2 {
            flushChunk()
        }
        Task { try? await stream?.stopCapture() }
        exit(0)
    }

    private func flushChunk() {
        guard !monoBuffer.isEmpty else { return }
        let path = (outDir as NSString).appendingPathComponent("chunk_\(chunkIndex).wav")
        writeWav(monoBuffer, to: path)
        monoBuffer.removeAll(keepingCapacity: true)
        chunkIndex += 1
        FileHandle.standardOutput.write("CHUNK:\(path)\n".data(using: .utf8)!)
    }

    private var frameLogCount = 0
    private var lastErrorLog = 0

    // SCStreamOutput: 音频采样回调（48kHz stereo s16le）
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }

        // 心跳日志：每 500 次回调打印一次缓冲状态
        frameLogCount += 1
        if frameLogCount % 500 == 0 || frameLogCount == 1 {
            FileHandle.standardError.write("AUDIO cb #\(frameLogCount) buffered=\(monoBuffer.count)\n".data(using: .utf8)!)
        }

        // 分配足够大的 AudioBufferList（SCK 可能输出多 buffer 非交错格式）
        let maxBuffers = 8
        let bufferListSize = MemoryLayout<AudioBufferList>.size + MemoryLayout<AudioBuffer>.size * (maxBuffers - 1)
        let memory = UnsafeMutableRawPointer.allocate(
            byteCount: bufferListSize,
            alignment: MemoryLayout<AudioBufferList>.alignment
        )
        defer { memory.deallocate() }
        let audioBufferList = memory.bindMemory(to: AudioBufferList.self, capacity: 1)
        // 必须预置 mNumberBuffers（立体声=2），否则 API 返回 -12737 InvalidEntryCount
        audioBufferList.pointee.mNumberBuffers = 2

        var blockBuffer: CMBlockBuffer?
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: audioBufferList,
            bufferListSize: bufferListSize,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr else {
            // 打印失败错误码（限频）
            if frameLogCount - lastErrorLog > 200 {
                FileHandle.standardError.write("AUDIO bufferlist error: \(status)\n".data(using: .utf8)!)
                lastErrorLog = frameLogCount
            }
            return
        }

        // 遍历所有 buffer（UnsafeMutableAudioBufferListPointer 支持下标访问）
        let ablPtr = UnsafeMutableAudioBufferListPointer(audioBufferList)
        var frames: [Int16] = []
        for buf in ablPtr {
            guard let p = buf.mData?.assumingMemoryBound(to: Int16.self) else { continue }
            let n = Int(buf.mDataByteSize) / 2
            if n > 0 {
                frames.append(contentsOf: UnsafeBufferPointer(start: p, count: n))
            }
        }
        let frameCount = frames.count
        guard frameCount >= 2 else { return }

        // 48k → 16k 整数下采样（每 3 帧取 LR 均值），单声道
        for f in 0..<(frameCount / 2) {
            let i = f * 2
            let l = Int(frames[i])
            let r = Int(frames[i + 1])
            if f % 3 == 0 {
                let m = (l + r) / 2
                monoBuffer.append(Int16(m))
            }
        }

        // chunk 满 → 写出
        if monoBuffer.count >= chunkTarget {
            flushChunk()
        }
    }
}

let manager = CaptureManager()

// SIGINT / SIGTERM → 优雅停止（写出残余音频）
signal(SIGINT) { _ in
    FileHandle.standardError.write("SIGINT received\n".data(using: .utf8)!)
    manager.stop()
}
signal(SIGTERM) { _ in
    FileHandle.standardError.write("SIGTERM received\n".data(using: .utf8)!)
    manager.stop()
}

let sem = DispatchSemaphore(value: 0)
Task {
    do {
        try await manager.start()
    } catch let err as SCStreamError {
        // 打印详细错误码：1000=权限被拒 等，便于定位
        FileHandle.standardError.write("ERROR: Start stream failed code=\(err.code.rawValue) \(err.localizedDescription)\n".data(using: .utf8)!)
        exit(1)
    } catch {
        FileHandle.standardError.write("ERROR: \(error.localizedDescription)\n".data(using: .utf8)!)
        exit(1)
    }
}
sem.wait()
