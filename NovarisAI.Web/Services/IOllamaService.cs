namespace NovarisAI.Web.Services;

public interface IOllamaService
{
    Task<string> AskAsync(string prompt, CancellationToken cancellationToken = default);
}