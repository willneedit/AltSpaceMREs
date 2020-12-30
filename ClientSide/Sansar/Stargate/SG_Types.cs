/*
 * Commonly used types throughout the Stargate project
 */

using System.Collections.Generic;

namespace Stargate
{
    using RequestParams = Dictionary<string, string>;

    // Mesh name translator
    public interface ISGMTranslator
    {
        string GetRealMeshName(string staticmeshname);
    }

    // Gate Client interface
    public interface IGate
    {
        string fqlid { get; }
        int numberBase { get; }
        bool busy { get; }

        void reset();

        void startSequence(string tgtFqlid, string tgtSequence, int[] tgtSeqNumbers, double timestamp);
        void lightChevron(int index, bool silent);
        void connect(string tgtFqlid);
        void disconnect(double timestamp);
    }

    // Gate Control interface
    public interface IGateControl
    {
        void QueueSGNCommand(string command, int timeout, RequestParams payload);
    }

    // See addressing.ts and locator.ts.
    // Of course I could have written a ReST-API for translation and have the client offload the work
    public class Common
    {
        public static uint getGalaxyDigit(string srcgalaxy) {
            if (srcgalaxy == "altspace") return 1;
            if (srcgalaxy == "sansar") return 2;
            return 0;
        }

        public static string translateToURL(string location, uint gid) {
            if (gid == 1) {
                // Legacy location strings don't have a space or event directive.
                // No idea how to distinguish between those two.
                if (location.Substring(0, 5) != "space/" && location.Substring(0, 5) != "event/") {
                    location = "space/" + location;
                }

                // Altspace: Translate 'event' to 'events' and 'space' to 'spaces' and decorate
                return "altspace://account.altvr.com/api/" +
                    location.Substring(0, 5) + "s" +
                    location.Substring(5);
            } else if (gid == 2) {
                // Use as-is and decorate;
                return "sansar://sansar.com/" + location;
            }

            return location;

        }

        public static string translateFQLIDToURL(string fqlid) {
            int pos = fqlid.IndexOf('/');
            string galaxy = fqlid.Substring(0,pos);
            string location = fqlid.Substring(pos+1);
            return Common.translateToURL(location, getGalaxyDigit(galaxy));
        }


    }
}