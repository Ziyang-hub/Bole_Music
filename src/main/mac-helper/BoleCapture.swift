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
        // 诊断：计算本块音频能量（RMS）——区分"静音"与"有声音但识别失败"
        var sumSq: Double = 0
        for s in monoBuffer {
            let v = Double(s) / 32768.0
            sumSq += v * v
        }
        let rms = sqrt(sumSq / Double(monoBuffer.count))
        let peak = Double(monoBuffer.map { abs(Int($0)) }.max() ?? 0) / 32768.0
        FileHandle.standardError.write(
            "CHUNK #\(chunkIndex) samples=\(monoBuffer.count) rms=\(String(format: "%.4f", rms)) peak=\(String(format: "%.3f", peak))\n"
            .data(using: .utf8)!)

        let path = (outDir as NSString).appendingPathComponent("chunk_\(chunkIndex).wav")
        writeWav(monoBuffer, to: path)
        monoBuffer.removeAll(keepingCapacity: true)
        chunkIndex += 1
        FileHandle.standardOutput.write("CHUNK:\(path)\n".data(using: .utf8)!)
    }

    private var frameLogCount = 0
    private var lastErrorLog = 0
    // 实时音量（LVL 上报）：每 500ms 计算一次 RMS
    private var levelSumSq: Double = 0
    private var levelCount = 0
    private var lastLevelTime = CFAbsoluteTimeGetCurrent()

    // 读取一个 AudioBuffer 的采样（支持 Float32 / Int16），统一转为 Int16
    private func readFrames(buf: AudioBuffer, isFloat32: Bool) -> [Int16] {
        guard let data = buf.mData else { return [] }
        let byteCount = Int(buf.mDataByteSize)
        if isFloat32 {
            let p = data.assumingMemoryBound(to: Float32.self)
            let n = byteCount / 4
            var out: [Int16] = []
            out.reserveCapacity(n)
            for i in 0..<n {
                let v = Double(p[i])
                let clamped = max(-1.0, min(1.0, v))
                out.append(Int16(clamped * 32767.0))
            }
            return out
        } else {
            let p = data.assumingMemoryBound(to: Int16.self)
            let n = byteCount / 2
            return Array(UnsafeBufferPointer(start: p, count: n))
        }
    }

    // SCStreamOutput: 音频采样回调（48kHz stereo s16le）
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }

        // 心跳日志：每 500 次回调打印一次缓冲状态
        frameLogCount += 1
        if frameLogCount % 500 == 0 || frameLogCount == 1 {
            FileHandle.standardError.write("AUDIO cb #\(frameLogCount) buffered=\(monoBuffer.count)\n".data(using: .utf8)!)
        }

        guard let asbd = sampleBuffer.formatDescription?.audioStreamBasicDescription else { return }
        // 诊断：首次打印实际音频格式
        if frameLogCount == 1 {
            FileHandle.standardError.write(
                "AUDIO format: rate=\(asbd.mSampleRate) ch=\(asbd.mChannelsPerFrame) nonInterleaved=\((asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0) bits=\(asbd.mBitsPerChannel)\n"
                .data(using: .utf8)!)
        }
        let nonInterleaved = (asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0
        let isFloat32 = (asbd.mFormatFlags & kAudioFormatFlagIsFloat) != 0

        // 标准两段式调用：第一段让系统返回所需大小（bufferListOut=nil，不涉及 mNumberBuffers），
        // 第二段按 sizeNeeded 分配。这是苹果文档的官方用法，绕开手动预置的所有语义差异。
        var sizeNeeded: Int = 0
        let s1 = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: &sizeNeeded,
            bufferListOut: nil,
            bufferListSize: 0,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            blockBufferOut: nil
        )
        guard s1 == noErr, sizeNeeded > 0 else {
            if frameLogCount - lastErrorLog > 200 {
                FileHandle.standardError.write("AUDIO query size error: \(s1) sizeNeeded=\(sizeNeeded)\n".data(using: .utf8)!)
                lastErrorLog = frameLogCount
            }
            return
        }

        let memory = UnsafeMutableRawPointer.allocate(byteCount: sizeNeeded, alignment: 16)
        defer { memory.deallocate() }
        let audioBufferList = memory.bindMemory(to: AudioBufferList.self, capacity: 1)

        var blockBuffer: CMBlockBuffer?
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: audioBufferList,
            bufferListSize: sizeNeeded,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr else {
            // 打印失败错误码（限频）
            if frameLogCount - lastErrorLog > 200 {
                FileHandle.standardError.write("AUDIO bufferlist error: \(status) sizeNeeded=\(sizeNeeded)\n".data(using: .utf8)!)
                lastErrorLog = frameLogCount
            }
            return
        }

        // 遍历所有 buffer（UnsafeMutableAudioBufferListPointer 支持下标访问）
        let ablPtr = UnsafeMutableAudioBufferListPointer(audioBufferList)
        let buffers = Array(ablPtr)
        guard !buffers.isEmpty else { return }

        if nonInterleaved && buffers.count >= 2 {
            // 非交错：buffer[0]=左声道, buffer[1]=右声道，每 3 帧取 1 帧，LR 平均 → 16k mono
            let left = readFrames(buf: buffers[0], isFloat32: isFloat32)
            let right = readFrames(buf: buffers[1], isFloat32: isFloat32)
            let n = min(left.count, right.count) / 3
            for i in 0..<n {
                let m = (Int(left[i * 3]) + Int(right[i * 3])) / 2
                monoBuffer.append(Int16(m))
            }
        } else {
            // 交错：L,R 交错排列，每 3 帧取 LR 平均 → 16k mono
            let frames = readFrames(buf: buffers[0], isFloat32: isFloat32)
            let fc = frames.count
            for f in 0..<(fc / 2) {
                let l = Int(frames[f * 2])
                let r = Int(frames[f * 2 + 1])
                if f % 3 == 0 {
                    monoBuffer.append(Int16((l + r) / 2))
                }
            }
        }

        // 累积音量采样
        for s in monoBuffer {
            let v = Double(s) / 32768.0
            levelSumSq += v * v
        }
        levelCount += monoBuffer.count
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastLevelTime >= 0.5 {
            let rms = levelCount > 0 ? sqrt(levelSumSq / Double(levelCount)) : 0
            FileHandle.standardOutput.write(String(format: "LVL:%.4f\n", rms).data(using: .utf8)!)
            levelSumSq = 0
            levelCount = 0
            lastLevelTime = now
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
