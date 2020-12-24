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
                    { "StaticMesh 20", "Symbol0_Unlit" },
                    { "StaticMesh 21", "Symbol1_Unlit" },
                    { "StaticMesh 22", "Symbol2_Unlit" },
                    { "StaticMesh 23", "Symbol3_Unlit" },
                    { "StaticMesh 24", "Symbol4_Unlit" },
                    { "StaticMesh 25", "Symbol5_Unlit" },
                    { "StaticMesh 26", "Symbol6_Unlit" },
                    { "StaticMesh 27", "Symbol7_Unlit" },
                    { "StaticMesh 28", "Symbol8_Unlit" },
                    { "StaticMesh 29", "Symbol9_Unlit" },
                    { "StaticMesh 30", "Symbol10_Unlit" },
                    { "StaticMesh 31", "Symbol11_Unlit" },
                    { "StaticMesh 32", "Symbol12_Unlit" },
                    { "StaticMesh 33", "Symbol13_Unlit" },
                    { "StaticMesh 34", "Symbol14_Unlit" },
                    { "StaticMesh 35", "Symbol15_Unlit" },
                    { "StaticMesh 36", "Symbol16_Unlit" },
                    { "StaticMesh 37", "Symbol17_Unlit" },
                    { "StaticMesh 38", "Symbol18_Unlit" },
                    { "StaticMesh 39", "Symbol19_Unlit" },
                    { "StaticMesh 40", "Symbol20_Unlit" },
                    { "StaticMesh 41", "Symbol21_Unlit" },
                    { "StaticMesh 42", "Symbol22_Unlit" },
                    { "StaticMesh 43", "Symbol23_Unlit" },
                    { "StaticMesh 44", "Symbol24_Unlit" },
                    { "StaticMesh 45", "Symbol25_Unlit" },
                    { "StaticMesh 46", "Symbol26_Unlit" },
                    { "StaticMesh 47", "Symbol27_Unlit" },
                    { "StaticMesh 48", "Symbol28_Unlit" },
                    { "StaticMesh 49", "Symbol29_Unlit" },
                    { "StaticMesh 50", "Symbol30_Unlit" },
                    { "StaticMesh 51", "Symbol31_Unlit" },
                    { "StaticMesh 52", "Symbol32_Unlit" },
                    { "StaticMesh 53", "Symbol33_Unlit" },
                    { "StaticMesh 54", "Symbol34_Unlit" },
                    { "StaticMesh 55", "Symbol35_Unlit" },
                    { "StaticMesh 56", "Panels" },
                    { "StaticMesh 57", "Symbol0_Lit" },
                    { "StaticMesh 58", "Symbol1_Lit" },
                    { "StaticMesh 59", "Symbol2_Lit" },
                    { "StaticMesh 60", "Symbol3_Lit" },
                    { "StaticMesh 61", "Symbol4_Lit" },
                    { "StaticMesh 62", "Symbol5_Lit" },
                    { "StaticMesh 63", "Symbol6_Lit" },
                    { "StaticMesh 64", "Symbol7_Lit" },
                    { "StaticMesh 65", "Symbol8_Lit" },
                    { "StaticMesh 66", "Symbol9_Lit" },
                    { "StaticMesh 67", "Symbol10_Lit" },
                    { "StaticMesh 68", "Symbol11_Lit" },
                    { "StaticMesh 69", "Symbol12_Lit" },
                    { "StaticMesh 70", "Symbol13_Lit" },
                    { "StaticMesh 71", "Symbol14_Lit" },
                    { "StaticMesh 72", "Symbol15_Lit" },
                    { "StaticMesh 73", "Symbol16_Lit" },
                    { "StaticMesh 74", "Symbol17_Lit" },
                    { "StaticMesh 75", "Symbol18_Lit" },
                    { "StaticMesh 76", "Symbol19_Lit" },
                    { "StaticMesh 77", "Symbol20_Lit" },
                    { "StaticMesh 78", "Symbol21_Lit" },
                    { "StaticMesh 79", "Symbol22_Lit" },
                    { "StaticMesh 80", "Symbol23_Lit" },
                    { "StaticMesh 81", "Symbol24_Lit" },
                    { "StaticMesh 82", "Symbol25_Lit" },
                    { "StaticMesh 83", "Symbol26_Lit" },
                    { "StaticMesh 84", "Symbol27_Lit" },
                    { "StaticMesh 85", "Symbol28_Lit" },
                    { "StaticMesh 86", "Symbol29_Lit" },
                    { "StaticMesh 87", "Symbol30_Lit" },
                    { "StaticMesh 88", "Symbol31_Lit" },
                    { "StaticMesh 89", "Symbol32_Lit" },
                    { "StaticMesh 90", "Symbol33_Lit" },
                    { "StaticMesh 91", "Symbol34_Lit" },
                    { "StaticMesh 92", "Symbol35_Lit" },
                };
            }   

            string newmeshname;
            if(namemap.TryGetValue(staticmeshname, out newmeshname)) 
                return newmeshname;
            
            return staticmeshname;
        }


    }
}