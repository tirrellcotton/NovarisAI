namespace NovarisAI.Core.Interfaces;

public interface IOllamaService
{
    Task<string> AskAsync(string prompt, CancellationToken cancellationToken = default);
}