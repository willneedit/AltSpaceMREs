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
    using RequestParams = Dictionary<string, string>;

    public struct Light
    {
        public MeshComponent lit;
        public MeshComponent unlit;
        public bool state;
    }

    [RegisterReflective]
    public class SG_Gate: SceneObjectScript, IGate
    {
        #region EditorProperties

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

        private List<Light> chevrons;
        private List<Light> symbols;

        private IGateControl thisGateControl = null;
        private ISGMTranslator thisModelTranslator = null;

        public string fqlid
        {
            get
            {
                SceneInfo info = ScenePrivate.SceneInfo;
                return "sansar/" + info.AvatarId + "/" + info.LocationHandle;
            }
        }

        public int numberBase { get; set; }

        public bool busy { get; set; }

        public List<Light> GatherLights(Dictionary<string, MeshComponent> meshes, string what, bool defaultState)
        {
            uint lightCount = 0;
            List<Light> lights = new List<Light>();

            while(true)
            {
                Light currentLight = new Light();

                if(!meshes.TryGetValue(what + lightCount + "_Lit", out currentLight.lit))
                    break;
                
                if(!meshes.TryGetValue(what + lightCount + "_Unlit", out currentLight.unlit))
                    break;
                
                currentLight.state = defaultState;
                currentLight.lit.SetIsVisible(defaultState);
                currentLight.unlit.SetIsVisible(!defaultState);
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
                Log.Write(LogLevel.Info, "Original mesh name: " + mc.Name, ", translated mesh name: " + name);
                meshes[name] = mc;
            }

            chevrons = GatherLights(meshes, "Chevron", false);
            symbols = GatherLights(meshes, "Symbol", false);

            Log.Write(LogLevel.Info, "Chevrons found:" + chevrons.Count + ", Symbols found: " + symbols.Count);

        }
        public override void Init()
        {
            thisModelTranslator = ScenePrivate.FindReflective<ISGMTranslator>("Stargate.SGA_Translator").FirstOrDefault();

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
        }

        public Light DoLight(Light which, bool state)
        {
            if(state == which.state) return which;

            which.state = state;
            which.lit.SetIsVisible(state);
            which.unlit.SetIsVisible(!state);

            return which;
        }

        public void reset()
        {
            for(int i = 0; i < chevrons.Count; i++)
                chevrons[i] = DoLight(chevrons[i], false);

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
            thisGateControl.QueueSGNCommand("lightChevron", 10000, new RequestParams() {
                { "index", "" + index },
                { "silent", silent ? "1" : "0" }
            });
        }

        private void SendConnect()
        {
            thisGateControl.QueueSGNCommand("connect", 10000, new RequestParams(){});
        }

        private void SendDisconnect()
        {
            thisGateControl.QueueSGNCommand("disconnect", 10000, new RequestParams(){
                { "timestamp", "" + _connectionTimeStamp }
            });
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
            chevrons[index] = DoLight(chevrons[index], true);
        }

        public void connect(string tgtFqlid)
        {
            Log.Write(LogLevel.Info, "Received Connection Open to " + tgtFqlid);
        }

        public void disconnect(double timestamp)
        {
            Log.Write(LogLevel.Info, "Received Connection Close");

            for(int i = 0; i < chevrons.Count; i++)
                chevrons[i] = DoLight(chevrons[i], false);

            // Restart listener loop, if not already running
            busy = false;
            thisGateControl.QueueSGNCommand("wait", 0, new RequestParams(){});
        }


    }
}