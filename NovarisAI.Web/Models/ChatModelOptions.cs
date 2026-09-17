namespace NovarisAI.Web.Models;

public static class ChatModelOptions
{
    public static IReadOnlyList<ChatModelOption> All { get; } =
    [
        new("qwen2.5-coder:7b", "Qwen Coder 7B — Fast coding"),
        new("qwen2.5-coder:14b", "Qwen Coder 14B — Main coding model"),
        new("gemma3:12b", "Gemma 3 12B — General assistant"),
        new("phi4", "Phi-4 — Technical reasoning")
    ];

    public static bool IsSupported(string? model)
    {
        return All.Any(option => option.Value.Equals(model, StringComparison.Ordinal));
    }
}
