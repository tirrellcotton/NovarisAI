namespace NovarisAI.Core.Models;

/// <summary>
/// Represents a response from the Ollama chat API.
/// </summary>
public sealed class OllamaChatResponse
{
    public string Model { get; set; } = string.Empty;
    public OllamaMessage Message { get; set; } = new OllamaMessage();
    public bool Done { get; set; }
}