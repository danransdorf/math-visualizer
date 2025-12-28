from manim import *

class DeMorganProof(Scene):
    def construct(self):
        # --- KONFIGURACE BAREV A TVARŮ ---
        # Barvy pro množiny
        C_A = BLUE
        C_B = GREEN
        C_C = RED
        C_X = GREY_A
        
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
        self.wait(0.5)

        # ---------------------------------------------------------
        # KROK 1: Doplněk sjednocení (Vnějšek všech)
        # ---------------------------------------------------------
        self.next_section("Krok 1")
        
        # Definujeme sjednocení tvarů
        union_shape = Union(set_A, set_B, set_C)
        # Definujeme doplněk (X bez Sjednocení)
        complement_of_union = Difference(universe, union_shape, color=GREY, fill_opacity=0.4, stroke_width=0)
        
        # Bod x vně
        dot_x = Dot(point=UR * 2.5 + LEFT * 1, color=YELLOW)
        lbl_x = MathTex("x").next_to(dot_x, UP)
        
        self.play(FadeIn(complement_of_union))
        self.play(FadeIn(dot_x), Write(lbl_x))
        self.wait(1)

        # ---------------------------------------------------------
        # KROK 2: Logický důsledek (Není v žádné)
        # ---------------------------------------------------------
        self.next_section("Krok 2")
        
        # Skryjeme šedou výplň, abychom se soustředili na kruhy
        self.play(FadeOut(complement_of_union))
        
        # Ukážeme šipky od kruhů k bodu s křížkem (negace)
        arrows = VGroup()
        for circle, col in zip([set_A, set_B, set_C], [C_A, C_B, C_C]):
            # Zvýraznění kruhu
            self.play(circle.animate.set_stroke(width=6), run_time=0.3)
            
            # Šipka a "notin"
            arrow = Arrow(start=circle.get_center(), end=dot_x.get_center(), buff=1.7, color=col)
            notin = MathTex(r"\notin").move_to(arrow.get_center()).shift(UP*0.2).rotate(arrow.get_angle())
            
            self.play(Create(arrow), FadeIn(notin), run_time=0.5)
            self.wait(0.3)
            
            # Úklid
            self.play(FadeOut(arrow), FadeOut(notin), circle.animate.set_stroke(width=4), run_time=0.3)
            arrows.add(arrow) # jen pro referenci

        self.wait(0.5)

        # ---------------------------------------------------------
        # KROK 3: Přechod k doplňkům (Vnějšek jednotlivě)
        # ---------------------------------------------------------
        self.next_section("Krok 3")
        
        # Pro ilustraci ukážeme doplněk množiny A (vše kromě A)
        comp_A = Difference(universe, set_A, color=C_A, fill_opacity=0.2, stroke_width=0)
        
        self.play(FadeIn(comp_A))
        # Zvýrazníme, že x tam je
        self.play(Indicate(dot_x, scale_factor=1.5, color=YELLOW))
        self.wait(1)
        
        # Rychle problikneme ostatní
        comp_B = Difference(universe, set_B, color=C_B, fill_opacity=0.2, stroke_width=0)
        self.play(ReplacementTransform(comp_A, comp_B))
        self.play(Indicate(dot_x))
        self.wait(0.5)
        self.play(FadeOut(comp_B))

        # ---------------------------------------------------------
        # KROK 4: Závěr 1 (Průnik doplňků)
        # ---------------------------------------------------------
        self.next_section("Krok 4")
        
        # Zobrazíme všechny doplňky najednou a jejich překryv
        # Vizuálně je to stejné jako Krok 1, ale myšlenkově to skládáme
        
        final_1 = Difference(universe, union_shape, color=TEAL, fill_opacity=0.5, stroke_width=0)
        txt_1 = Text("Průnik doplňků", font_size=36).to_edge(UP)
        
        self.play(FadeIn(final_1), Write(txt_1))
        self.wait(2)
        
        # --- RESET SCÉNY PRO DRUHOU ČÁST ---
        self.play(
            FadeOut(final_1), FadeOut(txt_1), 
            FadeOut(dot_x), FadeOut(lbl_x)
        )
        
        # ---------------------------------------------------------
        # KROK 5: Doplněk průniku (Mimo střed)
        # ---------------------------------------------------------
        self.next_section("Krok 5")
        
        # Definice průniku
        inter_AB = Intersection(set_A, set_B)
        intersection_all = Intersection(inter_AB, set_C, color=WHITE, fill_opacity=1)
        
        # Zvýrazníme střed
        self.play(FadeIn(intersection_all))
        
        # Bod Y umístíme do A, ale mimo B a C (tedy mimo průnik)
        # Pozice v horním kruhu (A), ale ne ve středu
        dot_y = Dot(point=set_A.get_center() + UP*0.8, color=YELLOW)
        lbl_y = MathTex("x").next_to(dot_y, UP)
        
        self.play(FadeIn(dot_y), Write(lbl_y))
        
        # Indikace: Není v bílém středu
        line_no = Line(dot_y.get_center(), intersection_all.get_center(), color=RED)
        cross = Cross(scale_factor=0.2).move_to(line_no.get_center())
        self.play(Create(line_no), Create(cross))
        self.wait(1)
        self.play(FadeOut(line_no), FadeOut(cross), FadeOut(intersection_all))

        # ---------------------------------------------------------
        # KROK 6: Existence výjimky (Nejsem v B)
        # ---------------------------------------------------------
        self.next_section("Krok 6")
        
        # Bod je v A, ale viditelně mimo B (a C). 
        # Zvýrazníme B jako "tady nejsem"
        self.play(set_B.animate.set_fill(opacity=0.4, color=C_B))
        
        arrow_not_in_B = Arrow(start=set_B.get_center(), end=dot_y.get_center(), color=C_B)
        txt_not_in = MathTex(r"x \notin B").next_to(arrow_not_in_B.get_center(), LEFT)
        
        self.play(GrowArrow(arrow_not_in_B), Write(txt_not_in))
        self.wait(1.5)
        
        self.play(FadeOut(arrow_not_in_B), FadeOut(txt_not_in), set_B.animate.set_fill(opacity=0.1))

        # ---------------------------------------------------------
        # KROK 7: Přechod k doplňku (Vnějšek B)
        # ---------------------------------------------------------
        self.next_section("Krok 7")
        
        # Zobrazíme doplněk B (X \ B)
        # To je obrovská plocha zahrnující i kus A, kde je náš bod
        comp_B_vis = Difference(universe, set_B, color=C_B, fill_opacity=0.2, stroke_width=0)
        
        self.play(FadeIn(comp_B_vis))
        txt_in_comp = MathTex(r"x \in (X \setminus B)").to_corner(UL)
        self.play(Write(txt_in_comp), Indicate(dot_y, color=WHITE))
        self.wait(1.5)
        
        self.play(FadeOut(comp_B_vis), FadeOut(txt_in_comp))

        # ---------------------------------------------------------
        # KROK 8: Závěr 2 (Sjednocení doplňků)
        # ---------------------------------------------------------
        self.next_section("Krok 8")
        
        # Ukážeme sjednocení doplňků = (X\A) U (X\B) U (X\C)
        # To vizuálně vytvoří "děravý" střed. Vše je barevné, jen průnik je prázdný.
        
        d_A = Difference(universe, set_A, fill_opacity=0.3, color=C_A, stroke_width=0)
        d_B = Difference(universe, set_B, fill_opacity=0.3, color=C_B, stroke_width=0)
        d_C = Difference(universe, set_C, fill_opacity=0.3, color=C_C, stroke_width=0)
        
        # Animujeme postupné "zakrývání"
        self.play(FadeIn(d_A), run_time=0.7)
        self.play(FadeIn(d_B), run_time=0.7) # Teď už je bod x zakrytý (protože je v doplňku B)
        self.play(FadeIn(d_C), run_time=0.7)
        
        txt_final = Text("Sjednocení doplňků", font_size=36).to_edge(DOWN)
        
        # Abychom ukázali, co zbylo (jen střed), vykreslíme hranici průniku
        border_int = Intersection(inter_AB, set_C, color=WHITE, stroke_width=2, fill_opacity=0)
        
        self.play(Write(txt_final), Create(border_int))
        self.wait(3)