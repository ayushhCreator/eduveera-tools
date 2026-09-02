/**
 * Kruti Dev visual-order <-> Unicode logical-order fixups.
 *
 * Legacy fonts like Kruti Dev store some characters in *visual* order (a
 * pre-base matra glyph typed before the consonant it visually precedes, or
 * a detached reph glyph typed after the syllable it attaches to). The bulk
 * glyph substitution in mappings/krutidev.ts + substitute.ts handles most
 * characters, but a handful of glyphs need their *position* fixed relative
 * to neighboring characters, which a simple substring substitution can not
 * express. This module holds exactly that: font-specific position-fixing
 * algorithms, kept separate from the mapping data itself (ARCHITECTURE.md
 * section 8, AI_RULES.md rule 11).
 *
 * Ported near-verbatim from TGNYC/Kriti-Dev-to-Unicode
 * (https://github.com/TGNYC/Kriti-Dev-to-Unicode, krutidevtounicode.js) --
 * see mappings/krutidev.ts for full source attribution. This was generated
 * by extracting the original functions’ source lines programmatically
 * and mechanically rewriting only var-hoisting and TS syntax (never
 * hand-retyping the Devanagari/extended-ASCII literals) specifically to
 * avoid transcription errors on combining characters and visually-similar
 * precomposed/decomposed codepoint pairs. Loop shapes (indexOf/search +
 * substring splice, not a regex rewrite) are kept close to the original
 * because that is what is verified against real Hindi text (see
 * __tests__/golden-corpus/krutidev/); a "cleaner" reimplementation would
 * risk silently changing behavior on edge cases the original was tuned for.
 *
 * Note: JS String.prototype.search() ignores a second (start-index)
 * argument -- the original source passes one (a copy/paste habit from
 * indexOf), so every .search() call here always re-scans from index 0.
 * This is intentional fidelity to the proven-correct original, not a bug.
 */

/**
 * Kruti Dev -> Unicode: run AFTER the ordered substitution table has been
 * applied. At this point the text is mostly Unicode, except for a few
 * legacy glyphs the substitution table deliberately does not cover because
 * they require repositioning, not just character replacement:
 *   - special compound glyphs (reph+anusvar, reph+ikar, ikar+anusvar
 *     variants) that expand into a marker sequence handled below.
 *   - "f": Kruti Dev’s ikar (ि) glyph, typed *before* its consonant.
 *   - "Z": Kruti Dev’s detached reph glyph, typed *after* its syllable.
 */
export function krutiToUnicodeFixups(text: string): string {
  let s = text;

let position_of_i: number;
let charecter_next_to_i: string;
let charecter_to_be_replaced: string;
let charecter_next_to_ip2: string;
let position_of_wrong_ee: number;
let consonent_next_to_wrong_ee: string;
let position_of_R: number;
let probable_position_of_half_r: number;
let charecter_at_probable_position_of_half_r: string;
let new_replacement_string: string;
            s = s.replace(/±/g, "Zं"); // at some places  ì  is  used eg  in "कर्कंधु,पूर्णांक".
            //
            //**********************************************************************************
            // Glyp2: Æ
            // code for replacing "f" with "ि" and correcting its position too. (moving it one position forward)
            //**********************************************************************************

            s = s.replace(/Æ/g, "र्f");  // at some places  Æ  is  used eg  in "धार्मिक".

            position_of_i = s.indexOf("f")

            while (position_of_i != -1)  //while-02
            {
                charecter_next_to_i = s.charAt(position_of_i + 1)
                charecter_to_be_replaced = "f" + charecter_next_to_i
                s = s.replace(charecter_to_be_replaced, charecter_next_to_i + "ि")
                position_of_i = s.search(/f/) // search for i ahead of the current position.

            } // end of while-02 loop

            //**********************************************************************************
            // Glyph3 & Glyph4: Ç  É
            // code for replacing "fa" with "िं"  and correcting its position too.(moving it two positions forward)
            //**********************************************************************************

            s = s.replace(/Ç/g, "fa"); // at some places  Ç  is  used eg  in "किंकर".
            s = s.replace(/É/g, "र्fa"); // at some places  É  is  used eg  in "शर्मिंदा"

            position_of_i = s.indexOf("fa")

            while (position_of_i != -1)  //while-02
            {
                charecter_next_to_ip2 = s.charAt(position_of_i + 2)
                charecter_to_be_replaced = "fa" + charecter_next_to_ip2
                s = s.replace(charecter_to_be_replaced, charecter_next_to_ip2 + "िं")
                position_of_i = s.search(/fa/) // search for i ahead of the current position.

            } // end of while-02 loop

            //**********************************************************************************
            // Glyph5: Ê
            // code for replacing "h" with "ी"  and correcting its position too.(moving it one positions forward)
            //**********************************************************************************

            s = s.replace(/Ê/g, "ीZ"); // at some places  Ê  is  used eg  in "किंकर".


            /*
            position_of_i = s.indexOf( "h" )
            
            while ( position_of_i != -1 )  //while-02
            {
            charecter_next_to_i = s.charAt( position_of_i + 1 )
            charecter_to_be_replaced = "h" + charecter_next_to_i
            s = s.replace( charecter_to_be_replaced , charecter_next_to_i + "ी" ) 
            position_of_i = s.search( /h/ , position_of_i + 1 ) // search for i ahead of the current position.
            
            } // end of while-02 loop
            */


            //**********************************************************************************
            // End of Code for Replacing four Special glyphs
            //**********************************************************************************

            // following loop to eliminate 'chhotee ee kee maatraa' on half-letters as a result of above transformation.

            position_of_wrong_ee = s.indexOf("ि्")

            while (position_of_wrong_ee != -1)  //while-03

            {
                consonent_next_to_wrong_ee = s.charAt(position_of_wrong_ee + 2)
                charecter_to_be_replaced = "ि्" + consonent_next_to_wrong_ee
                s = s.replace(charecter_to_be_replaced, "्" + consonent_next_to_wrong_ee + "ि")
                position_of_wrong_ee = s.search(/ि्/) // search for 'wrong ee' ahead of the current position. 

            } // end of while-03 loop

            //**************************************
            // 
            //**************************************
            //   alert(s);
            //**************************************

            // Eliminating reph "Z" and putting 'half - r' at proper position for this.
            const set_of_matras = "अ आ इ ई उ ऊ ए ऐ ओ औ ा ि ी ु ू ृ े ै ो ौ ं : ँ ॅ"
            position_of_R = s.indexOf("Z")

            while (position_of_R > 0)  // while-04
            {
                probable_position_of_half_r = position_of_R - 1;
                charecter_at_probable_position_of_half_r = s.charAt(probable_position_of_half_r)


                // trying to find non-maatra position left to current O (ie, half -r).

                while (set_of_matras.match(charecter_at_probable_position_of_half_r) != null)  // while-05

                {
                    probable_position_of_half_r = probable_position_of_half_r - 1;
                    charecter_at_probable_position_of_half_r = s.charAt(probable_position_of_half_r);

                } // end of while-05


                charecter_to_be_replaced = s.substr(probable_position_of_half_r, (position_of_R - probable_position_of_half_r));
                new_replacement_string = "र्" + charecter_to_be_replaced;
                charecter_to_be_replaced = charecter_to_be_replaced + "Z";
                s = s.replace(charecter_to_be_replaced, new_replacement_string);
                position_of_R = s.indexOf("Z");

            } // end of while-04

  return s;
}

/**
 * Unicode -> Kruti Dev: run BEFORE the ordered substitution table, on the
 * still-mostly-Unicode input. Repositions characters into Kruti Dev’s
 * visual-typing order and inserts the same "f"/"Z" ASCII markers the
 * kruti-to-unicode direction consumes, so the substitution table (which
 * only matches Unicode/Devanagari characters) leaves those markers alone.
 */
export function unicodeToKrutiFixups(text: string): string {
  let s = text;

let position_of_f: number;
let character_left_to_f: string;
let string_to_be_replaced: string;
let position_of_half_R: number;
let probable_position_of_Z: number;
let character_right_to_probable_position_of_Z: string;
            s = s.replace(/क़/, "क़");
            s = s.replace(/ख़‌/g, "ख़");
            s = s.replace(/ग़/g, "ग़");
            s = s.replace(/ज़/g, "ज़");
            s = s.replace(/ड़/g, "ड़");
            s = s.replace(/ढ़/g, "ढ़");
            s = s.replace(/ऩ/g, "ऩ");
            s = s.replace(/फ़/g, "फ़");
            s = s.replace(/य़/g, "य़");
            s = s.replace(/ऱ/g, "ऱ");


            // code for replacing "ि" (chhotee ee kii maatraa) with "f"  and correcting its position too.

            position_of_f = s.indexOf("ि");
            while (position_of_f != -1)  //while-02
            {
                character_left_to_f = s.charAt(position_of_f - 1);
                s = s.replace(character_left_to_f + "ि", "f" + character_left_to_f);

                position_of_f = position_of_f - 1;

                while (s.charAt(position_of_f - 1) == "्" && position_of_f != 0) {
                    string_to_be_replaced = s.charAt(position_of_f - 2) + "्";
                    s = s.replace(string_to_be_replaced + "f", "f" + string_to_be_replaced);

                    position_of_f = position_of_f - 2;
                }
                position_of_f = s.search(/ि/); // search for f ahead of the current position.

            } // end of while-02 loop
            //************************************************************     
            //     s = s.replace( /fर्/g , "£"  )  ;
            //************************************************************     
            // Eliminating "र्" and putting  Z  at proper position for this.

            const set_of_matras = "ािीुूृेैोौं:ँॅ"

            s += '  ';  // add two spaces after the string to avoid UNDEFINED char in the following code.

            position_of_half_R = s.indexOf("र्");
            while (position_of_half_R > 0)  // while-04
            {
                // "र्"  is two bytes long
                probable_position_of_Z = position_of_half_R + 2;

                character_right_to_probable_position_of_Z = s.charAt(probable_position_of_Z + 1)

                // trying to find non-maatra position right to probable_position_of_Z .

                while (set_of_matras.indexOf(character_right_to_probable_position_of_Z) != -1) {
                    probable_position_of_Z = probable_position_of_Z + 1;
                    character_right_to_probable_position_of_Z = s.charAt(probable_position_of_Z + 1);
                } // end of while-05

                string_to_be_replaced = s.substr(position_of_half_R + 2, (probable_position_of_Z - position_of_half_R - 1));
                s = s.replace("र्" + string_to_be_replaced, string_to_be_replaced + "Z");
                position_of_half_R = s.indexOf("र्");
            } // end of while-04


            s = s.substr(0, s.length - 2);

  return s;
}
