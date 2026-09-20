namespace NovarisAI.Core.Models;

/// <summary>
/// Represents a request to the Ollama chat API.
/// </summary>
public sealed class OllamaChatRequest
{
    public string Model { get; set; } = "qwen2.5-coder:14b";
    public List<OllamaMessage> Messages { get; set; } = [];
    public bool Stream { get; set; }
    public OllamaGenerationOptions Options { get; set; } = new();
}

/// <summary>
/// Controls how Ollama samples a model response.
/// </summary>
public sealed class OllamaGenerationOptions
{
    public double Temperature { get; set; }
}
