/*
 * Sansar client part of the Stargate
 * Dialing device part
 */

using Sansar.Script;
using Sansar.Simulation;
using System.Linq;
using System.Collections.Generic;
using Timer = Sansar.Script.Timer;

namespace Stargate
{
    public class SG_DHD : SceneObjectScript, IDHD
    {
        private IGateControl thisGateControl = null;

        private GateState state = GateState.Offline;

        public override void Init()
        {
            thisGateControl = ScenePrivate.FindReflective<IGateControl>("Stargate.SG_Control").FirstOrDefault();
            if (thisGateControl == null)
            {
                Log.Write(LogLevel.Error, "Gate Controller not found in scene.");
                return;
            }

            thisGateControl.ConnectDHD(this);
            ScenePrivate.Chat.Subscribe(0, Chat.User, OnChat);
        }

        private void OnChat(ChatData data)
        {
            AgentPrivate agent = ScenePrivate.FindAgent(data.SourceId);
            string[] argv = data.Message.Split(' ');

            if (agent == null) return;

            if (argv[0] == "/register")
            {
                RegisterSG(agent, true);
            }
            else if (argv[0] == "/deregister")
            {
                RegisterSG(agent, false);
            }
            else if (argv[0] == "/dial")
            {
                if (argv.Length < 2)
                {
                    ScenePrivate.Chat.MessageAllUsers("Error - need a valid address.");
                    return;
                }
                Dial(argv[1]);
            }
            else if (argv[0] == "/disconnect")
            {
                Disconnect();
            }
        }

        public void ReportState(GateState state)
        {
            this.state = state;
            Log.Write(LogLevel.Info, "Gate State: " + state);
        }

        private void RegisterSG(AgentPrivate who, bool register)
        {
            if(ScenePrivate.SceneInfo.AvatarUuid != who.AgentInfo.AvatarUuid)
            {
                ScenePrivate.Chat.MessageAllUsers("Only the owner of this world can register or deregister the gate.");
                return;
            }

            if (register)
                thisGateControl.QueueSGNCommand("register", 1000, null);
            else
                thisGateControl.QueueSGNCommand("deregister", 1000, null);
        }

        private void Dial(string tgtSequence)
        {
            if(state != GateState.Idle)
            {
                ScenePrivate.Chat.MessageAllUsers("Error - gate is in no state to receive dialout requests");
                return;
            }

            thisGateControl.QueueSGNCommand("startDialing", 1000, new RequestParams(){
                { "tgtSequence", tgtSequence }
            });
        }

        private void Disconnect()
        {
            if(state != GateState.Connected)
            {
                ScenePrivate.Chat.MessageAllUsers("Info - there is no open connection");
                return;
            }

            thisGateControl.DoGateDisconnect();
        }

    }
}