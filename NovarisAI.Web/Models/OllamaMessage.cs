namespace NovarisAI.Web.Models;

/// <summary>
/// Represents a message in an Ollama chat request.
/// </summary>
public sealed class OllamaMessage
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}  