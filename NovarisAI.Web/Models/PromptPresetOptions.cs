using NovarisAI.Core.Models;

namespace NovarisAI.Web.Models;

public static class PromptPresetOptions
{
    public static IReadOnlyList<PromptPreset> All { get; } =
    [
        PromptPreset.General,
        PromptPreset.CSharpDeveloper,
        PromptPreset.Frontend,
        PromptPreset.PythonDeveloper,
        PromptPreset.CodeReview,
        PromptPreset.UnitTests,
        PromptPreset.SoftwareArchitecture,
        PromptPreset.SQL,
        PromptPreset.Documentation,
        PromptPreset.Math,
        PromptPreset.AnalyticalReasoning,
        PromptPreset.TechnicalProblemSolving
    ];
}
