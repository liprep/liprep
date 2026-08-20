export const topicTree = {
  reading: {
    "Craft and Structure": [
      "Cross-text Connections",
      "Text Structure and Purpose",
      "Words in Context",
    ],
    "Expression of Ideas": [
      "Rhetorical Synthesis",
      "Transitions",
    ],
    "Information and Ideas": [
      "Central Ideas and Details",
      "Command of Evidence",
      "Inferences",
    ],
    "Standard English Conventions": [
      "Boundaries",
      "Form, Structure, and Sense",
    ],
  },
  math: {
    "Algebra": [
      "Linear equations in one variable",
      "Linear functions",
      "Linear equations in two variables",
      "Systems of two linear equations in two variables",
      "Linear inequalities in one or two variables",
    ],
    "Advanced Math": [
      "Equivalent expressions",
      "Nonlinear equations in one variable and systems of equations in two variables",
      "Nonlinear functions",
    ],
    "Problem-Solving and Data Analysis": [
      "Ratios, rates, proportional relationships, and units",
      "Percentages",
      "One-variable data: Distributions and measures of center and spread",
      "Two-variable data: Models and scatterplots",
      "Probability and conditional probability",
      "Inference from sample statistics and margin of error",
      "Evaluating statistical claims: Observational studies and experiments",
    ],
    "Geometry and Trigonometry": [
      "Area and volume",
      "Lines, angles, and triangles",
      "Right triangles and trigonometry",
      "Circles",
    ],
  },
};

export const topicCodes: Record<string, string> = {
  // Reading & Writing
  "Cross-text Connections": "CTC",
  "Text Structure and Purpose": "TSP",
  "Words in Context": "WIC",
  "Rhetorical Synthesis": "SYN",
  "Transitions": "TRA",
  "Central Ideas and Details": "CID",
  "Command of Evidence": "COE",
  "Inferences": "INF",
  "Boundaries": "BOU",
  "Form, Structure, and Sense": "FSS",

  // Math
  "Linear equations in one variable": "H.A.",
  "Linear functions": "H.B.",
  "Linear equations in two variables": "H.C.",
  "Systems of two linear equations in two variables": "H.D.",
  "Linear inequalities in one or two variables": "H.E.",
  "Equivalent expressions": "P.A.",
  "Nonlinear equations in one variable and systems of equations in two variables": "P.B.",
  "Nonlinear functions": "P.C.",
  "Ratios, rates, proportional relationships, and units": "Q.A.",
  "Percentages": "Q.B.",
  "One-variable data: Distributions and measures of center and spread": "Q.C.",
  "Two-variable data: Models and scatterplots": "Q.D.",
  "Probability and conditional probability": "Q.E.",
  "Inference from sample statistics and margin of error": "Q.F.",
  "Evaluating statistical claims: Observational studies and experiments": "Q.G.",
  "Area and volume": "S.A.",
  "Lines, angles, and triangles": "S.B.",
  "Right triangles and trigonometry": "S.C.",
  "Circles": "S.D.",
};

export const codeToNameMap: Record<string, string> = Object.entries(topicCodes).reduce(
  (acc, [name, code]) => {
    acc[code] = name;
    return acc;
  },
  {} as Record<string, string>
);

export const domainMap: Record<string, string> = {
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  INI: "Information and Ideas",
  SEC: "Standard English Conventions",
  H: "Algebra",
  P: "Advanced Math",
  Q: "Problem-Solving and Data Analysis",
  S: "Geometry and Trigonometry",
};

export const difficultyLabelMap: Record<string, string> = {
  E: "Easy",
  M: "Medium",
  H: "Hard",
  Easy: "Easy",
  Medium: "Medium",
  Hard: "Hard",
};

export function getDifficultyTierFromScoreBand(scoreBand: number): "Easy" | "Medium" | "Hard" {
  if (scoreBand <= 3) return "Easy";
  if (scoreBand <= 5) return "Medium";
  return "Hard";
}
