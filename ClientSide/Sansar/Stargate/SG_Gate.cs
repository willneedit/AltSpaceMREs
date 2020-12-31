/*
 * Sansar client part of the Stargate
 * Gate object script
 */

using Sansar.Script;
using Sansar.Simulation;
using System.Linq;
using System.Collections.Generic;
using Timer = Sansar.Script.Timer;

namespace Stargate
{

    public struct Light
    {
        public MeshComponent lit;
        public MeshComponent unlit;
        public bool state;
    }

    public class SG_Gate: SceneObjectScript, IGate
    {
        #region EditorProperties

        [Tooltip("Duration (in seconds) the wormhole stays open at maximum.")]
        [DisplayName("Wormhole duration")]
        [DefaultValue(120.0)]
        [Range(10.0, 240.0)]
        public readonly double _wormhole_duration;

        [Tooltip("Translator script for the mesh names (without 'Stargate.') - specific to the gate's mesh")]
        [DefaultValue("SGA_Translator")]
        public readonly string _translator_name;

        #endregion

        private string _currentTargetFQLID;
        private string _currentTargetSequence;
        private int[] _currentTargetSeqNumbers;
        private bool _currentDirection;
        private double _connectionTimeStamp;

        private List<Light> chevrons;
        private List<Light> symbols;
        private bool[] symbolLitState;

        private IEventHorizon thisEventHorizon = null;
        private IGateControl thisGateControl = null;
        private ISGMTranslator thisModelTranslator = null;

        private GateState idleState = GateState.Idle;

        public string fqlid
        {
            get
            {
                SceneInfo info = ScenePrivate.SceneInfo;
                //string location = info.SansarUri;
                //if (location.Substring(0, 9) == "sansar://")
                //    location = location.Substring(9);
                //return "sansar/" + location;
                return "sansar/experience/" + info.AvatarId + "/" + info.LocationHandle;
            }
        }

        public int numberBase { get; set; }

        public bool busy { get; set; }

        public List<Light> GatherLights(Dictionary<string, MeshComponent> meshes, string what)
        {
            uint lightCount = 0;
            List<Light> lights = new List<Light>();

            while(true)
            {
                Light currentLight = new Light();

                if(!meshes.TryGetValue(what + lightCount + "_Lit", out currentLight.lit))
                    currentLight.lit = null;
                
                if(!meshes.TryGetValue(what + lightCount + "_Unlit", out currentLight.unlit))
                    currentLight.unlit = null;
                
                if(currentLight.lit == null && currentLight.unlit == null)
                    break;

                currentLight.state = false;
                if(currentLight.unlit != null)
                    currentLight.unlit.SetIsVisible(true);

                if(currentLight.lit != null)
                    currentLight.lit.SetIsVisible(false);

                lights.Add(currentLight);

                lightCount++;
            }

            return lights;
        }

        public void AnalyzeGateStructure()
        {
            uint meshComponentCount = ObjectPrivate.GetComponentCount(ComponentType.MeshComponent);
            Dictionary<string, MeshComponent> meshes = new Dictionary<string, MeshComponent>();
            for(uint i = 0; i < meshComponentCount; i++)
            {
                MeshComponent mc = (MeshComponent) ObjectPrivate.GetComponent(ComponentType.MeshComponent, i);
                if(!mc.IsScriptable)
                    continue;

                string name = thisModelTranslator.GetRealMeshName(mc.Name);
                meshes[name] = mc;
            }

            chevrons = GatherLights(meshes, "Chevron");
            symbols = GatherLights(meshes, "Symbol");
            symbolLitState = new bool[symbols.Count];
            FlushLights();

            Log.Write(LogLevel.Info, "Chevrons found:" + chevrons.Count + ", Symbols found: " + symbols.Count);

        }
        public override void Init()
        {
            thisModelTranslator = ScenePrivate.FindReflective<ISGMTranslator>("Stargate." + _translator_name).FirstOrDefault();
            if(thisModelTranslator == null)
            {
                Log.Write(LogLevel.Error, "Need a gate model specific translator for the mesh names.");
                return;
            }

            AnalyzeGateStructure();
            numberBase = symbols.Count - 1;
            busy = false;

            thisGateControl = ScenePrivate.FindReflective<IGateControl>("Stargate.SG_Control").FirstOrDefault();
            if(thisGateControl == null)
            {
                Log.Write(LogLevel.Error, "Gate Controller not found in scene.");
                return;
            }

            thisEventHorizon = ScenePrivate.FindReflective<IEventHorizon>("Stargate.SG_EventHorizon").FirstOrDefault();
            if(thisEventHorizon == null)
                Log.Write(LogLevel.Warning, "Gate will not establish an event horizon. Object or script missing.");

            thisGateControl.ConnectGate(this);
        }

        public void FlushLights()
        {
            for(int i = 0; i < chevrons.Count; i++)
                DoLight(chevrons, i, false);
            
            for(int i = 0; i < symbols.Count; i++)
            {
                DoLight(symbols, i, false);
                symbolLitState[i] = false;
            }
        }

        public void DoLight(List<Light> lights, int index, bool state)
        {
            Light which = lights[index];

            if(state == which.state) return;

            which.state = state;
            if(which.lit != null)
                which.lit.SetIsVisible(state);
            
            if(which.unlit != null)
                which.unlit.SetIsVisible(!state);

            lights[index] = which;
        }

        public void reset()
        {
            FlushLights();

            if(thisEventHorizon != null)
                thisEventHorizon.Close();

            // If this gate is dialing out, send a Disconnect request to return it
            // and its counterpart to the idle state.
            if (busy) SendDisconnect();
            else thisGateControl.DoReportState(idleState);
        }

        /*
         * Control side: Send requests to SGNetwork, don't expect it to bounce back the events, they
         * will be handled locally.
         */
        private void SendLightChevron(int index, bool silent)
        {
            thisGateControl.QueueSGNCommand("lightChevron", 10000, new RequestParams() {
                { "index", "" + index },
                { "silent", silent ? "1" : "0" }
            });
        }

        private void SendConnect()
        {
            thisGateControl.QueueSGNCommand("connect", 10000, null);
        }

        private void SendDisconnect()
        {
            thisGateControl.QueueSGNCommand("disconnect", 10000, new RequestParams(){
                { "timestamp", "" + _connectionTimeStamp }
            });
        }

        // DialSequenceStep. Started with DialSequenceStep(0,0,1) to run the dialup for the given sequence
        public void DialSequenceStep(int seqIndex, int currentLit, int direction)
        {
            // If we ran through the sequence, open up.
            if(seqIndex == _currentTargetSeqNumbers.Length)
            {
                SendConnect();
                return;
            }

            // Target symbol for this chevron reached, light corresponding chevron, advance with next chevron.
            // Or open the gate if we got finished.
            if (currentLit == _currentTargetSeqNumbers[seqIndex])
            {
                symbolLitState[currentLit] = true;
                SendLightChevron(seqIndex, false);
                Timer.Create(1.0, () => { DialSequenceStep(seqIndex + 1, currentLit, -direction); });
                return;
            }

            // Return old light to previous state (not off - it might have been already on for a previous chevron)
            DoLight(symbols, currentLit, symbolLitState[currentLit]);

            // Select the 'next' symbol, according to direction, wrap around
            currentLit += direction;
            if(currentLit < 0) currentLit = symbols.Count - 1;
            else if(currentLit >= symbols.Count) currentLit = 0;

            DoLight(symbols, currentLit, true);

            // And continue spinning.
            Timer.Create(0.2, () => { DialSequenceStep(seqIndex, currentLit, direction); });
        }

        public void timeoutGate(double oldTs)
        {
            // Only time out if we're not already superseded by a later connection.
            if(oldTs != _connectionTimeStamp) return;

            SendDisconnect();
        }

        /*
         * Listener side: Receive events from a remote gate, routed by SGNetwork
         */

        public void startSequence(string tgtFqlid, string tgtSequence, int[] tgtSeqNumbers, double timestamp)
        {
            _currentTargetFQLID = tgtFqlid;
            _currentTargetSequence = tgtSequence;
            _currentTargetSeqNumbers = tgtSeqNumbers;
            _connectionTimeStamp = timestamp;

            _currentDirection = (tgtSequence == null);

            Log.Write(LogLevel.Info, "Received sequence start, tgt=" + tgtFqlid + ", seq=" + tgtSequence + ", initiate test");

            if(!_currentDirection)
            {
                busy = true;
                // Start dialing, sequence is given in _currentTargetSeqNumbers
                DialSequenceStep(0,0,1);
                thisGateControl.DoReportState(GateState.Dialing);
            }
            else
                thisGateControl.DoReportState(GateState.Incoming);
        }

        public void lightChevron(int index, bool silent)
        {
            Log.Write(LogLevel.Info, "Received Light Chevron, i=" + index + ", silent=" + silent);
            DoLight(chevrons, index, true);
        }

        public void connect(string tgtFqlid)
        {
            Log.Write(LogLevel.Info, "Received Connection Open to " + tgtFqlid);
            if(thisEventHorizon != null)
            {
                if(!_currentDirection)
                    thisEventHorizon.Open(tgtFqlid);
                else
                    thisEventHorizon.Open(null);
            }

            // If it's an outgoing gate, time out after the given duration.
            // Incoming gates are timed out by their counterpart.
            if(!_currentDirection)
            {
                double oldTs = _connectionTimeStamp;
                Timer.Create(_wormhole_duration, () => { timeoutGate(oldTs); });
            }

            thisGateControl.DoReportState(GateState.Connected);
        }

        public void disconnect(double timestamp)
        {
            Log.Write(LogLevel.Info, "Received Connection Close");

            // Remove busy state before resetting the gate to not to have the reset announce itself to the network.
            busy = false;
            reset();

            thisGateControl.DoReportState(idleState);

            // And restart the idle wait loop.
            thisGateControl.QueueSGNCommand("wait", 0, null);
        }


    }
}