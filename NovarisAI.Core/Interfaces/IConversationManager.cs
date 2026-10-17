using NovarisAI.Core.Models;

namespace NovarisAI.Core.Interfaces;

public interface IConversationManager
{
    Task<Conversation?> GetConversationAsync(int conversationId, CancellationToken cancellationToken);

    Conversation CreateConversation();

    Task AddMessageAsync(Conversation conversation, string role, string content, CancellationToken cancellationToken);

    Task<IReadOnlyList<ConversationMessage>> GetMessagesAsync(int? conversationId, CancellationToken cancellationToken);
}
