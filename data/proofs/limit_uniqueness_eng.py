from manim import (
    BLUE,
    GREEN,
    WHITE,
    DOWN,
    UP,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Scene,
    SurroundingRectangle,
    Text,
    MathTex,
    VGroup,
)


class LimitUniquenessV2(Scene):
    def construct(self):
        title = Text("Uniqueness of Limits ENG", font_size=38, color=WHITE).to_edge(UP)
        statement = MathTex(r"a_n \to L,\ a_n \to M \implies L = M", font_size=36, color=WHITE).next_to(
            title, DOWN, buff=0.25
        )

        self.next_section("Statement")
        self.play(FadeIn(VGroup(title, statement), shift=0.3 * UP))
        claim = Text("Same theorem, just in english.", font_size=28, color=GREEN).next_to(
            statement, DOWN, buff=0.35
        )
        self.play(FadeIn(claim, shift=0.2 * UP))
        self.wait(0.4)

        self.next_section("Contradiction setup")
        assume = MathTex(r"\text{Assume } L \neq M,\quad \varepsilon = \tfrac{|L - M|}{2} > 0", font_size=32).next_to(
            claim, DOWN, buff=0.55
        )
        assume_box = SurroundingRectangle(assume, buff=0.25, color=BLUE)
        self.play(FadeIn(assume, shift=0.2 * DOWN))
        self.play(GrowFromCenter(assume_box))
        self.wait(0.4)

        self.next_section("Convergence to both limits")
        conv = MathTex(
            r"\exists N_1, N_2:\ n \ge N_1 \Rightarrow |a_n - L| < \varepsilon,\ \ n \ge N_2 \Rightarrow |a_n - M| < \varepsilon",
            font_size=30,
            color=WHITE,
        ).next_to(assume_box, DOWN, buff=0.7)
        conv_box = SurroundingRectangle(conv, buff=0.25, color=BLUE)
        self.play(FadeOut(assume_box), FadeIn(conv, shift=0.25 * DOWN))
        self.play(GrowFromCenter(conv_box))
        self.wait(0.4)

        self.next_section("Pick common n")
        choose_n = MathTex(
            r"\text{Let } N = \max\{N_1, N_2\},\ n \ge N \Rightarrow |a_n - L|< \varepsilon \text{ and } |a_n - M|< \varepsilon",
            font_size=30,
            color=WHITE,
        ).next_to(conv_box, DOWN, buff=0.7)
        choose_box = SurroundingRectangle(choose_n, buff=0.25, color=BLUE)
        self.play(FadeOut(conv_box), FadeIn(choose_n, shift=0.25 * DOWN))
        self.play(GrowFromCenter(choose_box))
        self.wait(0.4)

        self.next_section("Contradiction")
        contradiction = MathTex(
            r"|L - M| \le |L - a_n| + |a_n - M| < \varepsilon + \varepsilon = |L - M|",
            font_size=32,
            color=WHITE,
        ).next_to(choose_box, DOWN, buff=0.7)
        conclude = Text("Therefore limits are equal.", font_size=32, color=GREEN).next_to(contradiction, DOWN, buff=0.35)
        contradiction_box = SurroundingRectangle(VGroup(contradiction, conclude), buff=0.35, color=BLUE)

        self.play(FadeOut(choose_box), FadeIn(contradiction, shift=0.25 * DOWN))
        self.play(FadeIn(conclude, shift=0.15 * DOWN))
        self.play(GrowFromCenter(contradiction_box))
        self.wait(0.6)
