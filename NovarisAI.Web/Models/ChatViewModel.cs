using System.ComponentModel.DataAnnotations;

namespace NovarisAI.Web.Models;

/// <summary>
/// Represents the view model for the Chat page, containing the prompt and response.
/// </summary>
public class ChatViewModel
{
    public int? ConversationId { get; set; }

    [Required]
    [Display(Name = "Model")]
    public string SelectedModel { get; set; } = "qwen2.5-coder:14b";

    [Display(Name = "Assistant mode")]
    public NovarisAI.Core.Models.PromptPreset PromptPreset { get; set; } =
        NovarisAI.Core.Models.PromptPreset.CSharpDeveloper;

    [Required]
    [Display(Name="Ask Novaris AI")]
    public string Prompt { get; set; } = string.Empty;

    public List<ChatMessageViewModel> Messages { get; set; } = [];
}
