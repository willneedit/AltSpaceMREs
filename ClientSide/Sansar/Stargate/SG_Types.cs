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


}