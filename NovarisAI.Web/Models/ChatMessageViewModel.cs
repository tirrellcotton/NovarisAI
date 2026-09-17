namespace NovarisAI.Web.Models;

public sealed class ChatMessageViewModel
{
    public string Role { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}
