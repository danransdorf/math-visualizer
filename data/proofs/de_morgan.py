from manim import *

class Part1(Scene):
    def construct(self):
        # ---------------------------------------------------------
        # KROK 0: Zobrazení tvrzení (Statement)
        # ---------------------------------------------------------
        self.next_section("Statement")
        
        statement_tex = MathTex(
            r"X \setminus \bigcup \mathcal{A} = \bigcap \{X \setminus A; A \in \mathcal{A}\}"
        ).scale(1.2)
        
        self.play(Write(statement_tex))
        self.wait(2)
        self.play(FadeOut(statement_tex))

        # ---------------------------------------------------------
        # SETUP: Konfigurace scény (Univerzum a množiny)
        # ---------------------------------------------------------
        # Barvy
        C_A = BLUE
        C_B = GREEN
        C_C = RED
        
        # Univerzum
        universe = Rectangle(height=6.5, width=11, color=WHITE, stroke_width=2)
        label_X = MathTex("X").move_to(universe.get_corner(UL) + DR * 0.5)
        
        # Množiny (kruhy)
        r = 1.8
        shift_amt = 1.0
        set_A = Circle(radius=r, color=C_A, fill_opacity=0.1).shift(UP * shift_amt * 0.8)
        set_B = Circle(radius=r, color=C_B, fill_opacity=0.1).shift(DL * shift_amt + LEFT * shift_amt * 0.8)
        set_C = Circle(radius=r, color=C_C, fill_opacity=0.1).shift(DL * shift_amt + RIGHT * shift_amt * 0.8)
        
        # Popisky
        lbl_A = MathTex("A").next_to(set_A, UP)
        lbl_B = MathTex("B").next_to(set_B, DL)
        lbl_C = MathTex("C").next_to(set_C, DR)

        sets_group = VGroup(set_A, set_B, set_C)
        labels_group = VGroup(lbl_A, lbl_B, lbl_C)
        
        # Zobrazení základu
        self.add(universe, label_X)
        self.play(Create(sets_group), Write(labels_group), run_time=1.5)

        # ---------------------------------------------------------
        # KROK 1: Doplněk sjednocení (Vnějšek všech)
        # ---------------------------------------------------------
        self.next_section("Krok 1")
        
        union_shape = Union(set_A, set_B, set_C)
        complement_of_union = Difference(universe, union_shape, color=GREY, fill_opacity=0.4, stroke_width=0)
        
        # Bod x vně
        dot_x = Dot(point=UR * 2.5 + LEFT * 1, color=YELLOW)
        lbl_x = MathTex("x").next_to(dot_x, UP)
        
        self.play(FadeIn(complement_of_union))
        self.play(FadeIn(dot_x), Write(lbl_x))

        # ---------------------------------------------------------
        # KROK 2: Logický důsledek (Není v žádné)
        # ---------------------------------------------------------
        self.next_section("Krok 2")
        
        self.play(FadeOut(complement_of_union))
        
        # Ukážeme šipky od kruhů k bodu s křížkem (negace)
        for circle, col in zip([set_A, set_B, set_C], [C_A, C_B, C_C]):
            self.play(circle.animate.set_stroke(width=6), run_time=0.3)
            
            arrow = Arrow(start=circle.get_center(), end=dot_x.get_center(), buff=1.7, color=col)
            notin = MathTex(r"\notin").move_to(arrow.get_center()).shift(UP*0.2).rotate(arrow.get_angle())
            
            self.play(Create(arrow), FadeIn(notin), run_time=0.5)
            self.wait(0.3)
            self.play(FadeOut(arrow), FadeOut(notin), circle.animate.set_stroke(width=4), run_time=0.3)

        # ---------------------------------------------------------
        # KROK 3: Přechod k doplňkům (Vnějšek jednotlivě)
        # ---------------------------------------------------------
        self.next_section("Krok 3")
        
        comp_A = Difference(universe, set_A, color=C_A, fill_opacity=0.2, stroke_width=0)
        
        self.play(FadeIn(comp_A))
        self.play(Indicate(dot_x, scale_factor=1.5, color=YELLOW))
        self.wait(1)
        
        comp_B = Difference(universe, set_B, color=C_B, fill_opacity=0.2, stroke_width=0)
        self.play(ReplacementTransform(comp_A, comp_B))
        self.play(Indicate(dot_x))
        self.wait(0.5)
        self.play(FadeOut(comp_B))

        # ---------------------------------------------------------
        # KROK 4: Závěr 1 (Průnik doplňků)
        # ---------------------------------------------------------
        self.next_section("Krok 4")
        
        final_1 = Difference(universe, union_shape, color=TEAL, fill_opacity=0.5, stroke_width=0)
        txt_1 = Text("Průnik doplňků", font_size=36).to_edge(UP)
        
        self.play(FadeIn(final_1), Write(txt_1))
        self.wait(2)


class Part2(Scene):
    def construct(self):
        # ---------------------------------------------------------
        # KROK 0: Zobrazení tvrzení (Statement) - Druhé pravidlo
        # ---------------------------------------------------------
        self.next_section("Statement")

        statement_tex = MathTex(
            r"X \setminus \bigcap \mathcal{A} = \bigcup \{X \setminus A; A \in \mathcal{A}\}"
        ).scale(1.2)
        
        self.play(Write(statement_tex))
        self.wait(2)
        self.play(FadeOut(statement_tex))

        # ---------------------------------------------------------
        # SETUP: Re-inicializace scény pro Part 2
        # ---------------------------------------------------------
        C_A, C_B, C_C = BLUE, GREEN, RED
        
        universe = Rectangle(height=6.5, width=11, color=WHITE, stroke_width=2)
        label_X = MathTex("X").move_to(universe.get_corner(UL) + DR * 0.5)
        
        r = 1.8
        shift_amt = 1.0
        set_A = Circle(radius=r, color=C_A, fill_opacity=0.1).shift(UP * shift_amt * 0.8)
        set_B = Circle(radius=r, color=C_B, fill_opacity=0.1).shift(DL * shift_amt + LEFT * shift_amt * 0.8)
        set_C = Circle(radius=r, color=C_C, fill_opacity=0.1).shift(DL * shift_amt + RIGHT * shift_amt * 0.8)
        
        lbl_A = MathTex("A").next_to(set_A, UP)
        lbl_B = MathTex("B").next_to(set_B, DL)
        lbl_C = MathTex("C").next_to(set_C, DR)
        
        sets_group = VGroup(set_A, set_B, set_C)
        labels_group = VGroup(lbl_A, lbl_B, lbl_C)

        self.add(universe, label_X)
        self.play(Create(sets_group), Write(labels_group), run_time=1.0)

        # ---------------------------------------------------------
        # KROK 5: Doplněk průniku (Mimo střed)
        # ---------------------------------------------------------
        self.next_section("Krok 5")
        
        # Definice průniku (střed)
        inter_AB = Intersection(set_A, set_B)
        intersection_all = Intersection(inter_AB, set_C, color=WHITE, fill_opacity=1, stroke_width=0)
        
        # Ukážeme, co je průnik
        self.play(FadeIn(intersection_all))
        
        # Bod x umístíme do A, ale mimo B a C (tedy mimo průnik všech)
        dot_x = Dot(point=set_A.get_center() + UP*0.8, color=YELLOW)
        lbl_x = MathTex("x").next_to(dot_x, UP)
        
        self.play(FadeIn(dot_x), Write(lbl_x))
        
        # Indikace: Není v bílém středu
        line_no = Line(dot_x.get_center(), intersection_all.get_center(), color=RED)
        cross = Cross(scale_factor=0.2).move_to(line_no.get_center())
        self.play(Create(line_no), Create(cross))
        self.wait(1)
        
        # Úklid vizualizace průniku
        self.play(FadeOut(line_no), FadeOut(cross), FadeOut(intersection_all))

        # ---------------------------------------------------------
        # KROK 6: Existence výjimky (Nejsem v B)
        # ---------------------------------------------------------
        self.next_section("Krok 6")
        
        # Zvýrazníme B jako množinu, ve které x není
        self.play(set_B.animate.set_fill(opacity=0.4, color=C_B))
        
        arrow_not_in_B = Arrow(start=set_B.get_center(), end=dot_x.get_center(), color=C_B)
        txt_not_in = MathTex(r"x \notin B").next_to(arrow_not_in_B.get_center(), LEFT)
        
        self.play(GrowArrow(arrow_not_in_B), Write(txt_not_in))
        self.wait(1.5)
        
        self.play(FadeOut(arrow_not_in_B), FadeOut(txt_not_in), set_B.animate.set_fill(opacity=0.1))

        # ---------------------------------------------------------
        # KROK 7: Přechod k doplňku (Vnějšek B)
        # ---------------------------------------------------------
        self.next_section("Krok 7")
        
        # Zobrazíme doplněk B (X \ B)
        # Toto je oblast, která pokrývá naše x
        comp_B_vis = Difference(universe, set_B, color=C_B, fill_opacity=0.2, stroke_width=0)
        
        self.play(FadeIn(comp_B_vis))
        txt_in_comp = MathTex(r"x \in (X \setminus B)").to_corner(UL)
        
        self.play(Write(txt_in_comp), Indicate(dot_x, color=WHITE, scale_factor=1.5))
        self.wait(1.5)
        
        self.play(FadeOut(comp_B_vis), FadeOut(txt_in_comp))

        # ---------------------------------------------------------
        # KROK 8: Závěr 2 (Sjednocení doplňků)
        # ---------------------------------------------------------
        self.next_section("Krok 8")
        
        # Ukážeme sjednocení doplňků = "všechno kromě středu"
        # Technicky vytvoříme tři doplňky a zobrazíme je přes sebe
        
        d_A = Difference(universe, set_A, fill_opacity=0.3, color=C_A, stroke_width=0)
        d_B = Difference(universe, set_B, fill_opacity=0.3, color=C_B, stroke_width=0)
        d_C = Difference(universe, set_C, fill_opacity=0.3, color=C_C, stroke_width=0)
        
        # Animujeme postupné "zakrývání"
        self.play(FadeIn(d_A), run_time=0.7)
        self.play(FadeIn(d_B), run_time=0.7) 
        self.play(FadeIn(d_C), run_time=0.7)
        
        txt_final = Text("Sjednocení doplňků", font_size=36).to_edge(DOWN)
        
        # Pro vizuální jasnost vykreslíme hranici průniku (toho bílého místa uprostřed, které zbylo prázdné)
        border_int = Intersection(inter_AB, set_C, color=WHITE, stroke_width=2, fill_opacity=0)
        
        self.play(Write(txt_final), Create(border_int))
        self.wait(2)