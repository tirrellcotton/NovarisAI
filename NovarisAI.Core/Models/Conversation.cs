namespace NovarisAI.Core.Models;

public sealed class Conversation
{
    public int Id { get; set; }

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }

    public List<ConversationMessage> Messages { get; set; } = [];
}
