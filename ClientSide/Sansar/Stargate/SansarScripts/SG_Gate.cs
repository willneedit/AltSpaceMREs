/*
 * Sansar client part of the Stargate
 * Gate object script
 */

using Sansar.Script;
using Sansar.Simulation;
using System.Linq;
using Timer = Sansar.Script.Timer;

namespace Stargate
{

    [RegisterReflective]
    public class SG_Gate: SceneObjectScript, IGate
    {
        #region EditorProperties

        [Tooltip("Numeric base of this gate, usu. 38")]
        [DefaultValue(38)]
        [DisplayName("Numeric Base")]
        public readonly int _numberBase;


        [Tooltip("Delay for test")]
        [DefaultValue(1.0)]
        [DisplayName("Delay")]
        [Range(0.5,5.0)]
        public readonly double _delay;
        #endregion

        private string _currentTargetFQLID;
        private string _currentTargetSequence;
        private bool _currentDirection;
        private double _connectionTimeStamp;

        private IGateControl thisGateControl = null;

        public string fqlid
        {
            get
            {
                SceneInfo info = ScenePrivate.SceneInfo;
                return "sansar/" + info.AvatarId + "/" + info.LocationHandle;
            }
        }

        public int numberBase { get { return _numberBase; } }

        public bool busy { get; set; }

        public override void Init()
        {
            busy = false;
            thisGateControl = ScenePrivate.FindReflective<IGateControl>("Stargate.SG_Control").FirstOrDefault();

            if(thisGateControl == null)
            {
                Log.Write(LogLevel.Error, "Gate Controller not found in scene.");
                return;
            }
        }

        public void reset()
        {
            // If this gate is dialing out, send a Disconnect request to return it
            // and its counterpart to the idle state.
            if (busy) SendDisconnect();
        }

        /*
         * Control side: Send requests to SGNetwork, don't expect it to bounce back the events, they
         * will be handled locally.
         */
        private void SendLightChevron(int index, bool silent)
        {
            thisGateControl.QueueSGNCommand("lightChevron", 10000,"index=" + index + "&silent=" + silent);
        }

        private void SendConnect()
        {
            thisGateControl.QueueSGNCommand("connect", 10000, "");
        }

        private void SendDisconnect()
        {
            thisGateControl.QueueSGNCommand("disconnect", 10000, "timestamp=" + _connectionTimeStamp);
        }

        public void TestSequence(int seq)
        {
            Log.Write(LogLevel.Info, "Chaining request " + seq);
            switch(seq)
            {
                case 1:
                    SendLightChevron(1, false);
                    break;
                case 2:
                    SendLightChevron(2, false);
                    break;
                case 3:
                    SendLightChevron(3, false);
                    break;
                case 4:
                    SendLightChevron(4, true);
                    break;
                case 5:
                    SendConnect();
                    break;
                case 6:
                    SendDisconnect();
                    break;
            }

            if (seq < 6)
                Timer.Create(_delay, () => { TestSequence(seq + 1); });
        }

        /*
         * Listener side: Receive events from a remote gate, routed by SGNetwork
         */

        public void startSequence(string tgtFqlid, string tgtSequence, double timestamp)
        {
            _currentTargetFQLID = tgtFqlid;
            _currentTargetSequence = tgtSequence;
            _connectionTimeStamp = timestamp;

            _currentDirection = (tgtSequence == null);

            if(!_currentDirection)
            {
                Log.Write(LogLevel.Info, "Gate is dialing out, set to busy state");
                busy = true;
            }

            Log.Write(LogLevel.Info, "Received sequence start, tgt=" + tgtFqlid + ", seq=" + tgtSequence + ", initiate test");
            TestSequence(1);
        }

        public void lightChevron(int index, bool silent)
        {
            Log.Write(LogLevel.Info, "Received Light Chevron, i=" + index + ", silent=" + silent);
        }

        public void connect(string tgtFqlid)
        {
            Log.Write(LogLevel.Info, "Received Connection Open to " + tgtFqlid);
        }

        public void disconnect(double timestamp)
        {
            Log.Write(LogLevel.Info, "Received Connection Close");

            // Restart listener loop, if not already running
            busy = false;
            thisGateControl.QueueSGNCommand("wait", 0, "");
        }


    }
}