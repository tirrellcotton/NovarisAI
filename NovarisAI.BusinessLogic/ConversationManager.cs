using Microsoft.EntityFrameworkCore;
using NovarisAI.Core.Interfaces;
using NovarisAI.Core.Models;
using NovarisAI.DataAccess.Contexts;

namespace NovarisAI.BusinessLogic;

/// <summary>
/// Manages conversations and their messages, providing methods to retrieve, create, and add messages to conversations.
/// </summary>
/// <param name="novarisDbContext">The database context used to access conversation data.</param>
public class ConversationManager(NovarisDbContext novarisDbContext) : IConversationManager
{
    /// <summary>
    /// Retrieves a conversation by its ID, including its associated messages.
    /// </summary>
    /// <param name="conversationId">The ID of the conversation to retrieve.</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    /// <returns>The conversation with the specified ID, or null if not found.</returns>
    public Task<Conversation?> GetConversationAsync(int conversationId, CancellationToken cancellationToken)
    {
        return novarisDbContext.Conversations
            .Include(item => item.Messages)
            .SingleOrDefaultAsync(item => item.Id == conversationId, cancellationToken);
    }

    /// <summary>
    /// Creates a new conversation.
    /// </summary>
    /// <returns>The newly created conversation.</returns>
    public Conversation CreateConversation()
    {
        var now = DateTime.UtcNow;
        var conversation = new Conversation
        {
            CreatedUtc = now,
            UpdatedUtc = now
        };

        novarisDbContext.Conversations.Add(conversation);
        return conversation;
    }

    /// <summary>
    /// Adds a message to the specified conversation.
    /// </summary>
    /// <param name="conversation">The conversation to which the message will be added.</param>
    /// <param name="role">The role of the message sender.</param>
    /// <param name="content">The content of the message.</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    public async Task AddMessageAsync(Conversation conversation, string role, string content,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        conversation.Messages.Add(new ConversationMessage
        {
            Role = role,
            Content = content,
            CreatedUtc = now
        });
        conversation.UpdatedUtc = now;

        await novarisDbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Retrieves the messages for the specified conversation.
    /// </summary>
    /// <param name="conversationId">The ID of the conversation whose messages are to be retrieved.</param>
    /// <param name="cancellationToken">A token to monitor for cancellation requests.</param>
    /// <returns>A read-only list of messages for the specified conversation.</returns>
    public async Task<IReadOnlyList<ConversationMessage>> GetMessagesAsync(int? conversationId,
        CancellationToken cancellationToken)
    {
        if (conversationId is null)
        {
            return [];
        }

        return await novarisDbContext.ConversationMessages
            .AsNoTracking()
            .Where(message => message.ConversationId == conversationId)
            .OrderBy(message => message.Id)
            .ToListAsync(cancellationToken);
    }
}
