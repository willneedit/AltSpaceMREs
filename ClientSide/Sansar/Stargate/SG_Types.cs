/*
 * Commonly used types throughout the Stargate project
 */

using System.Collections.Generic;

namespace Stargate
{

    public class RequestParams : Dictionary<string, string>
    {

    }

    // Used for visually reporting the state of the gate, not to maintain
    // the internal state machine.
    public enum GateState
    {
        Offline = 0,            // Gate is offline, no no connection to the network
        Unregistered,           // Gate is not registered to the network
        Idle,                   // Idle, awaiting commands or incoming connections
        Dialing,                // Dialing out
        Incoming,               // Establishing incoming connection
        Connected               // Connected, wormhole open
    }

    // Mesh name translator
    public interface ISGMTranslator
    {
        string GetRealMeshName(string staticmeshname);
    }

    // Event Horizon interface
    public interface IEventHorizon
    {
        void Open(string target); // FQLID for outgoing connection, null for incoming.
        void Close();
    }

    // DHD Interface
    public interface IDHD
    {
        void ReportState(GateState state);
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
        void ConnectGate(IGate gate);
        void ConnectDHD(IDHD dhd);
        void QueueSGNCommand(string command, int timeout, RequestParams payload);
        void DoGateDisconnect();
        void DoReportState(GateState state);
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