namespace NovarisAI.Core.Interfaces;

public interface IOllamaService
{
    Task<string> AskAsync(
        IReadOnlyCollection<NovarisAI.Core.Models.OllamaMessage> messages,
        string model,
        NovarisAI.Core.Models.PromptPreset promptPreset,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyCollection<NovarisAI.Core.Models.OllamaMessage> messages,
        string model,
        NovarisAI.Core.Models.PromptPreset promptPreset,
        CancellationToken cancellationToken = default);
}
