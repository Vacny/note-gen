import Foundation
import Vision
import Tauri

struct RecognizedLine {
    let text: String
    let x: CGFloat
    let y: CGFloat
}

struct RecognizeArgs: Decodable {
    let imagePath: String
    let languages: [String]?
}

struct RecognizeResponse: Encodable {
    let text: String
}

struct OcrFailure: Error, LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

func normalizeLanguage(_ language: String) -> String? {
    let normalized = language
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "_", with: "-")
        .lowercased()

    if normalized.isEmpty {
        return nil
    }

    switch normalized {
    case "eng", "en", "en-us":
        return "en-US"
    case "chi-sim", "zh", "zh-cn", "zh-hans":
        return "zh-Hans"
    case "chi-tra", "zh-tw", "zh-hant":
        return "zh-Hant"
    case "jpn", "ja", "ja-jp":
        return "ja-JP"
    case "kor", "ko", "ko-kr":
        return "ko-KR"
    default:
        return language
    }
}

func defaultRecognitionLanguages() -> [String] {
    [
        "zh-Hans",
        "zh-Hant",
        "en-US",
        "ja-JP",
        "ko-KR",
    ]
}

func supportedRecognitionLanguages(for request: VNRecognizeTextRequest) -> Set<String> {
    guard #available(iOS 15.0, *) else {
        return []
    }

    do {
        return Set(try request.supportedRecognitionLanguages())
    } catch {
        return []
    }
}

func setRecognitionLanguages(_ languages: [String], for request: VNRecognizeTextRequest) {
    let normalizedLanguages = languages.compactMap(normalizeLanguage)
    let candidateLanguages = normalizedLanguages.isEmpty
        ? defaultRecognitionLanguages()
        : normalizedLanguages
    let supportedLanguages = supportedRecognitionLanguages(for: request)
    let usableLanguages = supportedLanguages.isEmpty
        ? candidateLanguages
        : candidateLanguages.filter { supportedLanguages.contains($0) }

    if !usableLanguages.isEmpty {
        request.recognitionLanguages = usableLanguages
    }
}

func sortedRecognizedLines(from observations: [VNRecognizedTextObservation]) -> [String] {
    observations.compactMap { observation -> RecognizedLine? in
        guard let candidate = observation.topCandidates(1).first else {
            return nil
        }

        return RecognizedLine(
            text: candidate.string,
            x: observation.boundingBox.minX,
            y: observation.boundingBox.midY
        )
    }
    .sorted { lhs, rhs in
        if abs(lhs.y - rhs.y) > 0.02 {
            return lhs.y > rhs.y
        }

        return lhs.x < rhs.x
    }
    .map(\.text)
}

func recognizeText(imagePath: String, languages: [String]) throws -> String {
    guard !imagePath.isEmpty else {
        throw OcrFailure(message: "Missing imagePath")
    }

    let imageUrl = URL(fileURLWithPath: imagePath)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    if #available(iOS 16.0, *) {
        request.automaticallyDetectsLanguage = true
    }

    setRecognitionLanguages(languages, for: request)

    let handler = VNImageRequestHandler(url: imageUrl, options: [:])
    try handler.perform([request])

    return sortedRecognizedLines(from: request.results ?? []).joined(separator: "\n")
}

class OcrPlugin: Plugin {
    @objc public func recognize(_ invoke: Invoke) throws {
        do {
            let args = try invoke.parseArgs(RecognizeArgs.self)

            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let text = try recognizeText(
                        imagePath: args.imagePath,
                        languages: args.languages ?? []
                    )
                    DispatchQueue.main.async {
                        invoke.resolve(RecognizeResponse(text: text))
                    }
                } catch {
                    DispatchQueue.main.async {
                        invoke.reject(error.localizedDescription)
                    }
                }
            }
        } catch {
            invoke.reject(error.localizedDescription)
        }
    }
}

@_cdecl("init_plugin_ocr")
func initPlugin() -> Plugin {
    return OcrPlugin()
}
