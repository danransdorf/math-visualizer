from manim import *

class SqueezeTheoremFinal(Scene):
    def construct(self):
        # ---------------------------------------------------------
        # SETUP: Axes and Constants
        # ---------------------------------------------------------
        
        axes = Axes(
            x_range=[-1, 7, 1],
            y_range=[-1, 6, 1],
            x_length=10,
            y_length=7,
            axis_config={"include_tip": True, "color": GREY},
        ).shift(UP * 1.5) 
        
        labels = axes.get_axis_labels(x_label="x", y_label="y")
        
        c_val = 3.0
        A_val = 3.0
        epsilon_val = 1.0 
        
        # --- Function Definitions ---
        func_f = lambda x: A_val - 0.2 * (x - c_val)**2
        func_g = lambda x: A_val + 1.5 * (x - c_val)**2 
        func_h = lambda x: A_val + (0.2 * (x - c_val)**2) * np.sin(10 * (x - c_val))

        # Calculate exact geometric deltas
        delta_f_calc = np.sqrt(epsilon_val / 0.2)
        delta_g_calc = np.sqrt(epsilon_val / 1.5)

        dot_c = Dot(axes.c2p(c_val, 0), color=WHITE)
        label_c = MathTex("c").next_to(dot_c, DOWN)
        dot_A = Dot(axes.c2p(0, A_val), color=WHITE)
        label_A = MathTex("A").next_to(dot_A, LEFT)

        # ---------------------------------------------------------
        # INTRO
        # ---------------------------------------------------------
        self.play(Create(axes), Write(labels))
        self.play(FadeIn(dot_c), Write(label_c), FadeIn(dot_A), Write(label_A))

        graph_f_intro = axes.plot(func_f, x_range=[0, 6], color=BLUE)
        graph_g_intro = axes.plot(func_g, x_range=[c_val - 1.5, c_val + 1.5], color=GREEN)
        graph_h_intro = axes.plot(func_h, x_range=[0, 6], color=ORANGE)
        
        lbl_f = MathTex("f").next_to(graph_f_intro, RIGHT).set_color(BLUE)
        lbl_g = MathTex("g").next_to(graph_g_intro, UP).set_color(GREEN)
        lbl_h = MathTex("h").next_to(graph_h_intro, RIGHT).set_color(ORANGE)

        title_intro = Text("Věta o dvou strážnících", font_size=36).to_edge(UP)

        self.play(
            Create(graph_f_intro), 
            Create(graph_g_intro), 
            Create(graph_h_intro),
            Write(lbl_f), Write(lbl_g), Write(lbl_h),
            Write(title_intro)
        )

        # ---------------------------------------------------------
        # PROOF STEP 1: Epsilon
        # ---------------------------------------------------------
        self.next_section("Epsilon Band")
        
        self.play(
            FadeOut(graph_f_intro), FadeOut(graph_g_intro), FadeOut(graph_h_intro),
            FadeOut(lbl_f), FadeOut(lbl_g), FadeOut(lbl_h),
            FadeOut(title_intro)
        )
        
        line_upper = DashedLine(axes.c2p(-1, A_val + epsilon_val), axes.c2p(7, A_val + epsilon_val), color=YELLOW)
        line_lower = DashedLine(axes.c2p(-1, A_val - epsilon_val), axes.c2p(7, A_val - epsilon_val), color=YELLOW)
        
        label_eps = MathTex(r"\varepsilon").next_to(line_upper, RIGHT, buff=0.1).set_color(YELLOW)
        
        epsilon_zone = Rectangle(
            width=axes.coords_to_point(7, 0)[0] - axes.coords_to_point(-1, 0)[0],
            height=axes.coords_to_point(0, A_val + epsilon_val)[1] - axes.coords_to_point(0, A_val - epsilon_val)[1],
            fill_color=YELLOW,
            fill_opacity=0.15,
            stroke_width=0
        ).move_to(axes.c2p(3, A_val))

        self.play(
            Create(line_upper), Create(line_lower),
            Write(label_eps),
            FadeIn(epsilon_zone)
        )

        # ---------------------------------------------------------
        # PROOF STEP 2: Delta 1 (The Wide One - f(x))
        # ---------------------------------------------------------
        self.next_section("Delta 1 (Bottom Function)")

        graph_f = axes.plot(func_f, x_range=[0, 6], color=BLUE)
        label_f_step = MathTex("f(x)").next_to(graph_f, RIGHT).set_color(BLUE)
        self.play(Create(graph_f), Write(label_f_step))

        x_start_d1 = c_val - delta_f_calc
        x_end_d1 = c_val + delta_f_calc

        line_d1 = Line(axes.c2p(x_start_d1, 0), axes.c2p(x_end_d1, 0)).shift(DOWN * 0.7)
        brace_d1 = Brace(line_d1, DOWN, buff=0.1).set_color(BLUE)
        text_d1 = brace_d1.get_text(r"$\delta_1$ (pro $f$)").scale(0.8)

        v_lines_d1 = VGroup(
            DashedLine(axes.c2p(x_start_d1, 0), axes.c2p(x_start_d1, func_f(x_start_d1)), color=BLUE_A),
            DashedLine(axes.c2p(x_end_d1, 0), axes.c2p(x_end_d1, func_f(x_end_d1)), color=BLUE_A)
        )

        self.play(Create(v_lines_d1))
        self.play(GrowFromCenter(brace_d1), Write(text_d1))

        # ---------------------------------------------------------
        # PROOF STEP 3: Delta 2 (The Narrow One - g(x))
        # ---------------------------------------------------------
        self.next_section("Delta 2 (Top Function)")

        graph_g = axes.plot(func_g, x_range=[c_val - 1.2, c_val + 1.2], color=GREEN)
        label_g_step = MathTex("g(x)").next_to(graph_g, UP).set_color(GREEN)
        self.play(Create(graph_g), Write(label_g_step))

        x_start_d2 = c_val - delta_g_calc
        x_end_d2 = c_val + delta_g_calc

        line_d2 = Line(axes.c2p(x_start_d2, 0), axes.c2p(x_end_d2, 0)).shift(DOWN * 2.0)
        brace_d2 = Brace(line_d2, DOWN, buff=0.1).set_color(GREEN)
        text_d2 = brace_d2.get_text(r"$\delta_2$ (pro $g$)").scale(0.8)

        v_lines_d2 = VGroup(
            DashedLine(axes.c2p(x_start_d2, 0), axes.c2p(x_start_d2, func_g(x_start_d2)), color=GREEN_A),
            DashedLine(axes.c2p(x_end_d2, 0), axes.c2p(x_end_d2, func_g(x_end_d2)), color=GREEN_A)
        )

        self.play(Create(v_lines_d2))
        self.play(GrowFromCenter(brace_d2), Write(text_d2))

        # ---------------------------------------------------------
        # PROOF STEP 4: Picking the Minimum
        # ---------------------------------------------------------
        self.next_section("Compare Deltas")

        self.play(
            Indicate(brace_d2, color=RED),
            Indicate(brace_d1, scale_factor=1.0)
        )
        
        final_delta = delta_g_calc
        
        line_final = Line(axes.c2p(c_val - final_delta, 0), axes.c2p(c_val + final_delta, 0), color=RED, stroke_width=6)
        brace_final = Brace(line_final, UP, buff=0.1).set_color(RED)
        text_final = brace_final.get_text(r"$\delta = \min$").scale(0.8).set_background_stroke(color=BLACK, width=5)

        self.play(
            FadeOut(brace_d1), FadeOut(text_d1), FadeOut(v_lines_d1),
            FadeOut(brace_d2), FadeOut(text_d2), FadeOut(v_lines_d2),
        )

        self.play(
            Create(line_final),
            GrowFromCenter(brace_final),
            Write(text_final)
        )
        
        safe_strip = Rectangle(
            width=axes.coords_to_point(c_val + final_delta, 0)[0] - axes.coords_to_point(c_val - final_delta, 0)[0],
            height=7, 
            fill_color=RED,
            fill_opacity=0.2,
            stroke_width=0
        ).move_to(axes.c2p(c_val, 2.5))
        
        self.play(FadeIn(safe_strip))

        # ---------------------------------------------------------
        # PROOF STEP 5: Conclusion
        # ---------------------------------------------------------
        self.next_section("Conclusion")

        graph_h = axes.plot(func_h, x_range=[0, 6], color=ORANGE)
        label_h_step = MathTex("h(x)").next_to(graph_h, RIGHT).set_color(ORANGE)

        self.play(Create(graph_h), Write(label_h_step))

        h_segment = axes.plot(func_h, x_range=[c_val - final_delta, c_val + final_delta], color=WHITE, stroke_width=6)
        self.play(Create(h_segment))
        
        conclusion = MathTex(
            r"\text{Pro } x \in (c-\delta, c+\delta):",
            r"|h(x) - A| < \varepsilon"
        ).scale(0.9).to_edge(UP).set_background_stroke(color=BLACK, width=5)
        
        self.play(Write(conclusion))

        # ---------------------------------------------------------
        # PROOF STEP 6: Dynamic Adjustment (Uzavření důkazu)
        # ---------------------------------------------------------
        self.next_section("Dynamic Adjustment")

        # Create ValueTracker for Epsilon
        e_tracker = ValueTracker(epsilon_val)

        # Helper to calculate delta based on current epsilon
        # We use the relationship from g(x) since it was the limiting factor (coeff 1.5)
        get_dyn_delta = lambda: np.sqrt(e_tracker.get_value() / 1.5)

        # Create Dynamic Mobjects using always_redraw
        
        # 1. Dynamic Epsilon lines
        dyn_line_upper = always_redraw(lambda: DashedLine(
            axes.c2p(-1, A_val + e_tracker.get_value()), 
            axes.c2p(7, A_val + e_tracker.get_value()), color=YELLOW
        ))
        dyn_line_lower = always_redraw(lambda: DashedLine(
            axes.c2p(-1, A_val - e_tracker.get_value()), 
            axes.c2p(7, A_val - e_tracker.get_value()), color=YELLOW
        ))
        
        # 2. Dynamic Yellow Box
        dyn_eps_zone = always_redraw(lambda: Rectangle(
            width=axes.coords_to_point(7, 0)[0] - axes.coords_to_point(-1, 0)[0],
            height=axes.coords_to_point(0, A_val + e_tracker.get_value())[1] - axes.coords_to_point(0, A_val - e_tracker.get_value())[1],
            fill_color=YELLOW, fill_opacity=0.15, stroke_width=0
        ).move_to(axes.c2p(3, A_val)))

        # 3. Dynamic Delta Line (Red) on axis
        dyn_line_final = always_redraw(lambda: Line(
            axes.c2p(c_val - get_dyn_delta(), 0), 
            axes.c2p(c_val + get_dyn_delta(), 0), 
            color=RED, stroke_width=6
        ))

        # 4. Dynamic Brace
        dyn_brace_final = always_redraw(lambda: Brace(dyn_line_final, UP, buff=0.1).set_color(RED))
        
        # 5. Dynamic Safe Strip (Red vertical zone)
        dyn_safe_strip = always_redraw(lambda: Rectangle(
            width=axes.coords_to_point(c_val + get_dyn_delta(), 0)[0] - axes.coords_to_point(c_val - get_dyn_delta(), 0)[0],
            height=7, fill_color=RED, fill_opacity=0.2, stroke_width=0
        ).move_to(axes.c2p(c_val, 2.5)))

        # 6. Dynamic White Segment of h(x)
        dyn_h_segment = always_redraw(lambda: axes.plot(
            func_h, x_range=[c_val - get_dyn_delta(), c_val + get_dyn_delta()], 
            color=WHITE, stroke_width=6
        ))

        # Swap static objects for dynamic ones instantly
        self.add(dyn_line_upper, dyn_line_lower, dyn_eps_zone, dyn_line_final, dyn_brace_final, dyn_safe_strip, dyn_h_segment)
        self.remove(line_upper, line_lower, epsilon_zone, line_final, brace_final, text_final, safe_strip, h_segment, label_eps)

        # Final Text from JSON
        final_text_lines = VGroup(
            Tex(r"$\lim_{x \to c} h(x) = A$.")
        ).arrange(DOWN).scale(0.8).to_edge(UP).set_background_stroke(color=BLACK, width=5)

        self.play(FadeOut(conclusion), Write(final_text_lines))

        # Animate the shrinking process
        self.play(e_tracker.animate.set_value(0.15), run_time=5, rate_func=linear)