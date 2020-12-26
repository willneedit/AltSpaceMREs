/*
 * Sansar client part of the Stargate
 * Mesh name translator script
 */

using Sansar.Script;
using Sansar.Simulation;
using Sansar.Utility;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Stargate
{
    [RegisterReflective]
    public class SGA_Translator : SceneObjectScript, ISGMTranslator
    {
        private Dictionary<string, string> namemap = null;

        public override void Init()
        {

        }

        public string GetRealMeshName(string staticmeshname)
        {
            if(namemap == null)
            {
                namemap = new Dictionary<string, string>(){
                    { "StaticMesh 1",  "Frame" },
                    { "StaticMesh 2",  "Chevron0_Lit" },
                    { "StaticMesh 3",  "Chevron1_Lit" },
                    { "StaticMesh 4",  "Chevron2_Lit" },
                    { "StaticMesh 5",  "Chevron3_Lit" },
                    { "StaticMesh 6",  "Chevron4_Lit" },
                    { "StaticMesh 7",  "Chevron5_Lit" },
                    { "StaticMesh 8",  "Chevron6_Lit" },
                    { "StaticMesh 9",  "Chevron7_Lit" },
                    { "StaticMesh 10", "Chevron8_Lit" },
                    { "StaticMesh 11", "Chevron0_Unlit" },
                    { "StaticMesh 12", "Chevron1_Unlit" },
                    { "StaticMesh 13", "Chevron2_Unlit" },
                    { "StaticMesh 14", "Chevron3_Unlit" },
                    { "StaticMesh 15", "Chevron4_Unlit" },
                    { "StaticMesh 16", "Chevron5_Unlit" },
                    { "StaticMesh 17", "Chevron6_Unlit" },
                    { "StaticMesh 18", "Chevron7_Unlit" },
                    { "StaticMesh 19", "Chevron8_Unlit" },
                    { "StaticMesh 20", "Symbol0_Lit" },
                    { "StaticMesh 21", "Symbol1_Lit" },
                    { "StaticMesh 22", "Symbol2_Lit" },
                    { "StaticMesh 23", "Symbol3_Lit" },
                    { "StaticMesh 24", "Symbol4_Lit" },
                    { "StaticMesh 25", "Symbol5_Lit" },
                    { "StaticMesh 26", "Symbol6_Lit" },
                    { "StaticMesh 27", "Symbol7_Lit" },
                    { "StaticMesh 28", "Symbol8_Lit" },
                    { "StaticMesh 29", "Symbol9_Lit" },
                    { "StaticMesh 30", "Symbol10_Lit" },
                    { "StaticMesh 31", "Symbol11_Lit" },
                    { "StaticMesh 32", "Symbol12_Lit" },
                    { "StaticMesh 33", "Symbol13_Lit" },
                    { "StaticMesh 34", "Symbol14_Lit" },
                    { "StaticMesh 35", "Symbol15_Lit" },
                    { "StaticMesh 36", "Symbol16_Lit" },
                    { "StaticMesh 37", "Symbol17_Lit" },
                    { "StaticMesh 38", "Symbol18_Lit" },
                    { "StaticMesh 39", "Symbol19_Lit" },
                    { "StaticMesh 40", "Symbol20_Lit" },
                    { "StaticMesh 41", "Symbol21_Lit" },
                    { "StaticMesh 42", "Symbol22_Lit" },
                    { "StaticMesh 43", "Symbol23_Lit" },
                    { "StaticMesh 44", "Symbol24_Lit" },
                    { "StaticMesh 45", "Symbol25_Lit" },
                    { "StaticMesh 46", "Symbol26_Lit" },
                    { "StaticMesh 47", "Symbol27_Lit" },
                    { "StaticMesh 48", "Symbol28_Lit" },
                    { "StaticMesh 49", "Symbol29_Lit" },
                    { "StaticMesh 50", "Symbol30_Lit" },
                    { "StaticMesh 51", "Symbol31_Lit" },
                    { "StaticMesh 52", "Symbol32_Lit" },
                    { "StaticMesh 53", "Symbol33_Lit" },
                    { "StaticMesh 54", "Symbol34_Lit" },
                    { "StaticMesh 55", "Symbol35_Lit" },
                    { "StaticMesh 56", "Panels" },
                };
            }   

            string newmeshname;
            if(namemap.TryGetValue(staticmeshname, out newmeshname)) 
                return newmeshname;
            
            return staticmeshname;
        }


    }
}