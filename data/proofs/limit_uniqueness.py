from manim import *

class LimitUniquenessVisual(Scene):
    def construct(self):
        # --- Setup Visual Elements ---
        number_line = NumberLine(
            x_range=[-4, 4, 1], 
            length=10, 
            color=GRAY, 
            include_numbers=False
        ).shift(DOWN * 0.5)

        l_pos = number_line.n2p(-2)
        m_pos = number_line.n2p(2)
        
        # Dots for L and M
        dot_L = Dot(l_pos, color=TEAL, radius=0.12)
        label_L = MathTex("L", color=TEAL).next_to(dot_L, DOWN)
        
        dot_M = Dot(m_pos, color=MAROON, radius=0.12)
        label_M = MathTex("M", color=MAROON).next_to(dot_M, DOWN)

        # -----------------------------------------------------
        # Section 1: Statement
        # -----------------------------------------------------
        self.next_section("Tvrzení")
        
        self.play(Create(number_line))
        
        self.play(
            FadeIn(dot_L, scale=0.5), Write(label_L),
            FadeIn(dot_M, scale=0.5), Write(label_M)
        )
        self.wait(1)


        # -----------------------------------------------------
        # Section 2: Contradiction setup (Epsilon neighborhoods)
        # -----------------------------------------------------
        self.next_section("Příprava sporu")

        dist_brace = BraceBetweenPoints(l_pos, m_pos, UP)
        dist_text = dist_brace.get_text(r"$|L - M|$")
        
        self.play(GrowFromCenter(dist_brace), FadeIn(dist_text))
        self.wait(0.5)

        nbhd_L = Line(number_line.n2p(-2 - 1.8), number_line.n2p(-2 + 1.8), color=TEAL, stroke_width=8, stroke_opacity=0.5)
        nbhd_L_brace = Brace(nbhd_L, UP, buff=0.5).set_color(TEAL)
        nbhd_L_text = nbhd_L_brace.get_text(r"$ (L-\varepsilon, L+\varepsilon) $").scale(0.7)

        # M Neighborhood
        nbhd_M = Line(number_line.n2p(2 - 1.8), number_line.n2p(2 + 1.8), color=MAROON, stroke_width=8, stroke_opacity=0.5)
        nbhd_M_brace = Brace(nbhd_M, UP, buff=0.5).set_color(MAROON)
        nbhd_M_text = nbhd_M_brace.get_text(r"$ (M-\varepsilon, M+\varepsilon) $").scale(0.7)

        # Transition from distance brace to Epsilon neighborhoods
        self.play(
            ReplacementTransform(dist_brace, nbhd_L_brace),
            ReplacementTransform(dist_text, nbhd_L_text),
            FadeIn(nbhd_M_brace),
            FadeIn(nbhd_M_text)
        )
        self.play(Create(nbhd_L), Create(nbhd_M))
        
        # Emphasize disjoint
        disjoint_text = Text("Disjunktní okolí!", font_size=24, color=YELLOW).next_to(number_line, UP, buff=2.5)
        self.play(FadeIn(disjoint_text))
        self.wait(1)


        # -----------------------------------------------------
        # Section 3: Convergence to L
        # -----------------------------------------------------
        self.next_section("Konvergence k L")

        dots_L = VGroup()
        for i in range(5):
            # Random positions inside L's epsilon neighborhood
            x_val = -2 + (np.random.random() - 0.5) * 2  
            d = Dot(number_line.n2p(x_val), color=WHITE, radius=0.08)
            dots_L.add(d)

        label_n1 = MathTex(r"n \ge N_1", color=WHITE, font_size=30).next_to(nbhd_L, DOWN, buff=0.2)
        
        self.play(
            FadeOut(disjoint_text),
            LaggedStart(*[FadeIn(d, scale=0.5) for d in dots_L], lag_ratio=0.1),
            Write(label_n1)
        )
        self.wait(0.5)


        # -----------------------------------------------------
        # Section 4: Convergence to M
        # -----------------------------------------------------
        self.next_section("Konvergence k M")

        dots_M = VGroup()
        for i in range(5):
            # Random positions inside M's epsilon neighborhood
            x_val = 2 + (np.random.random() - 0.5) * 2
            d = Dot(number_line.n2p(x_val), color=WHITE, radius=0.08)
            dots_M.add(d)

        label_n2 = MathTex(r"n \ge N_2", color=WHITE, font_size=30).next_to(nbhd_M, DOWN, buff=0.2)

        self.play(
            LaggedStart(*[FadeIn(d, scale=0.5) for d in dots_M], lag_ratio=0.1),
            Write(label_n2)
        )
        self.wait(0.5)


        # -----------------------------------------------------
        # Section 5: Pick common index
        # -----------------------------------------------------
        self.next_section("Volba společného indexu")

        # Clear previous generic dots to focus
        self.play(FadeOut(dots_L), FadeOut(dots_M))

        # Create a single dot representing a_N
        # It pulsates between L and M to show the confusion/requirement
        a_n_L = Dot(number_line.n2p(-2.2), color=YELLOW, radius=0.15) # Inside L
        a_n_M = Dot(number_line.n2p(2.2), color=YELLOW, radius=0.15)  # Inside M
        
        a_n_label = MathTex(r"a_N", color=YELLOW).next_to(a_n_L, UP, buff=0.1)

        max_N_text = Text("Pro n > max(N1, N2)", font_size=24, color=YELLOW).to_edge(UP)
        
        self.play(FadeIn(max_N_text))
        
        # Show the dot appearing in L
        self.play(FadeIn(a_n_L), Write(a_n_label))
        
        self.play(
            ReplacementTransform(a_n_L, a_n_M),
            a_n_label.animate.next_to(a_n_M, UP, buff=0.1)
        )
        self.play(
            ReplacementTransform(a_n_M, a_n_L),
            a_n_label.animate.next_to(a_n_L, UP, buff=0.1)
        )
        self.wait(0.5)


        # -----------------------------------------------------
        # Section 6: Contradiction
        # -----------------------------------------------------
        self.next_section("Spor")

        # Highlight the gap
        gap = Line(number_line.n2p(-0.2), number_line.n2p(0.2), color=RED, stroke_width=10)
        impossible_text = Text("NEMOŽNÉ", font_size=60, color=RED).move_to(UP * 2)

        self.play(FadeIn(impossible_text), FadeIn(gap))
        self.play(Indicate(gap))
        
        # To resolve, L must equal M.
        # Animate M moving to L
        self.play(
            FadeOut(a_n_L), FadeOut(a_n_label), FadeOut(impossible_text), FadeOut(gap),
            FadeOut(nbhd_M), FadeOut(nbhd_M_brace), FadeOut(nbhd_M_text), FadeOut(label_n2),
            FadeOut(nbhd_L), FadeOut(nbhd_L_brace), FadeOut(nbhd_L_text), FadeOut(label_n1),
            FadeOut(max_N_text)
        )

        self.play(
            dot_M.animate.move_to(dot_L.get_center()),
            label_M.animate.next_to(dot_L, DOWN, buff=0.5), # Offset slightly to see both
            run_time=2
        )
        
        conclusion = MathTex(r"L = M", font_size=48, color=GREEN).next_to(dot_L, UP, buff=1.0)
        self.play(Write(conclusion))
        self.play(Circumscribe(conclusion))
        
        self.wait(2)