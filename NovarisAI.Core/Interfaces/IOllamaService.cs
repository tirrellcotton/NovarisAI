namespace NovarisAI.Core.Interfaces;

public interface IOllamaService
{
    Task<string> AskAsync(
        IReadOnlyCollection<NovarisAI.Core.Models.OllamaMessage> messages,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<string> AskStreamAsync(
        IReadOnlyCollection<NovarisAI.Core.Models.OllamaMessage> messages,
        CancellationToken cancellationToken = default);
}
