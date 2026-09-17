namespace NovarisAI.Core.Models;

public sealed class ConversationMessage
{
    public int Id { get; set; }

    public int ConversationId { get; set; }

    public Conversation Conversation { get; set; } = null!;

    public string Role { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedUtc { get; set; }
}
