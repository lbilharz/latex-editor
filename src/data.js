// data.js — Symbol tables for LaTeX commands

export const SYMBOLS = {
    // Greek lowercase
    '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ',
    '\\epsilon':'ε','\\varepsilon':'ε','\\zeta':'ζ','\\eta':'η',
    '\\theta':'θ','\\vartheta':'ϑ','\\iota':'ι','\\kappa':'κ',
    '\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ',
    '\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\tau':'τ',
    '\\phi':'φ','\\varphi':'ϕ','\\chi':'χ','\\psi':'ψ','\\omega':'ω',
    // Greek uppercase
    '\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ',
    '\\Xi':'Ξ','\\Pi':'Π','\\Sigma':'Σ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω',
    // Number sets
    '\\N':'ℕ','\\Z':'ℤ','\\Q':'ℚ','\\R':'ℝ','\\C':'ℂ',
    // Misc symbols
    '\\infty':'∞','\\partial':'∂','\\nabla':'∇','\\emptyset':'∅','\\O':'∅',
    '\\forall':'∀','\\exists':'∃','\\neg':'¬',
    // Operators
    '\\pm':'±','\\mp':'∓','\\times':'×','\\cdot':'·','\\div':'÷',
    '\\circ':'∘','\\bullet':'•','\\star':'⋆','\\odot':'⊙',
    // Relations
    '\\leq':'≤','\\le':'≤','\\geq':'≥','\\ge':'≥',
    '\\neq':'≠','\\ne':'≠',
    '\\approx':'≈','\\apx':'≈',
    '\\equiv':'≡','\\sim':'∼','\\simeq':'≃','\\cong':'≅',
    '\\ll':'≪','\\gg':'≫',
    '\\propto':'∝','\\perp':'⊥','\\parallel':'∥',
    // Set operations
    '\\in':'∈','\\notin':'∉','\\ni':'∋',
    '\\subset':'⊂','\\supset':'⊃','\\subseteq':'⊆','\\supseteq':'⊇',
    '\\cup':'∪','\\cap':'∩','\\setminus':'∖',
    '\\land':'∧','\\lor':'∨',
    // Arrows
    '\\to':'→','\\rightarrow':'→','\\leftarrow':'←',
    '\\leftrightarrow':'↔','\\Rightarrow':'⇒','\\Leftarrow':'⇐',
    '\\Leftrightarrow':'⇔','\\mapsto':'↦',
    '\\uparrow':'↑','\\downarrow':'↓',
    // Geometry (cheatsheet dialect)
    '\\angle':'∠','\\triangle':'△',
    '\\permil':'‰',
    // Does-not-divide (cheatsheet: \notl)
    '\\notl':'∤','\\nmid':'∤','\\mid':'∣',
};

export const FUNCTIONS = new Set([
    'sin','cos','tan','cot','sec','csc',
    'arcsin','arccos','arctan',
    'sinh','cosh','tanh',
    'ln','log','exp','lim','max','min','sup','inf',
    'det','dim','ker','gcd','lcm','deg',
    'arg','mod',
]);

export const LARGE_OPS = {
    '\\sum':'∑','\\prod':'∏','\\coprod':'∐',
    '\\int':'∫','\\iint':'∬','\\iiint':'∭',
    '\\oint':'∮',
    '\\bigcup':'⋃','\\bigcap':'⋂',
    '\\bigoplus':'⊕','\\bigotimes':'⊗',
};
