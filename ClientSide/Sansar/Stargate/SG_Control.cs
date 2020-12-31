/*
 * Sansar client part of the Stargate
 * Control script
 */

using Sansar.Script;
using Sansar.Simulation;
using Sansar.Utility;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Stargate
{

    public class CtrlDataJSON
    {
        public string status { get; set; }
        public string status_data1 { get; set; }
        public string error { get; set; }
        public string command { get; set; }
        public string tgtFqlid { get; set; }
        public string tgtSequence { get; set; }
        public int[] tgtSeqNumbers { get; set; }
        public double timestamp { get; set; }
        public int index { get; set; }
        public bool silent { get; set; }
    }

    [RegisterReflective]
    public class SG_Control : SceneObjectScript, IGateControl
    {

        #region EditorProperties

        [Tooltip("Listen to incoming events when gate is idle. Turning it off reduces traffic jam, but stops letting you see remote activation")]
        [DefaultValue(true)]
        [DisplayName("Listen to SGNetwork")]
        public readonly bool _listenSGN;

        [Tooltip("Base URL of the Stargate network server (default: Debug metwork)")]
        [DefaultValue("http://willneedit-mre.ddnsup.com")]
        [DisplayName("Server URL")]
        public readonly string baseUrl;

        #endregion

        private IGate thisGate = null;
        private IDHD thisDHD = null;

        private bool abortRequested = false;
        private bool running = false;
        private bool announced = false;

        private Queue<HttpRequestOptions> commandQueue = new Queue<HttpRequestOptions>();

        private void HandleSGNetworkEvent(JsonSerializationData<CtrlDataJSON[]> obj)
        {
            CtrlDataJSON[] jd = obj.Object;
            foreach(var jdi in jd)
            {
                if (jdi.status != null)
                {
                    if(jdi.status == "Gate announcement OK")
                    {
                        Log.Write(LogLevel.Info, "Server responded to gate announcement, we're online. Own address=" + jdi.status_data1);
                        DoReportState(GateState.Idle);
                        announced = true;
                    }
                    else if(jdi.status == "Gate announcement OK, but gate is unregistered")
                    {
                        Log.Write(LogLevel.Info, "Server responded to gate announcement, we're online, but the gate is unregistered. Own address=" + jdi.status_data1);
                        DoReportState(GateState.Unregistered);
                        announced = true;
                    }
                    else if(jdi.status == "Gate registration successful")
                    {
                        Log.Write(LogLevel.Info, "Received registration response, scheduling for reannouncement");
                        announced = false;
                    }
                    else if(jdi.status == "Gate deregistration successful")
                    {
                        Log.Write(LogLevel.Info, "Received deregistration response, scheduling for reannouncement");
                        announced = false;
                    }
                    else
                        Log.Write(LogLevel.Info, "SGNetwork status response: " + jdi.status);
                }
                else if(jdi.error != null)
                {
                    Log.Write(LogLevel.Warning, "SGNetwork error response: " + jdi.error);
                }
                else if (jdi.command == "startSequence")
                {
                    thisGate.startSequence(jdi.tgtFqlid, jdi.tgtSequence, jdi.tgtSeqNumbers, jdi.timestamp);
                }
                else if (jdi.command == "lightChevron")
                {
                    thisGate.lightChevron(jdi.index, jdi.silent);
                }
                else if (jdi.command == "connect")
                {
                    thisGate.connect(jdi.tgtFqlid);
                }
                else if (jdi.command == "disconnect")
                {
                    thisGate.disconnect(jdi.timestamp);
                }
                else
                {
                    Log.Write(LogLevel.Warning, "Unknown command received: " + jdi.command);
                }
            }

            ListenSGEvent();

        }

        private void ParseSGEvent(HttpClient.RequestData result)
        {
            running = false;

            if (result.Success)
            {
                try
                {
                    Log.Write(LogLevel.Info, "SGNetwork event received: " + result.Response.Body);
                    JsonSerializer.Deserialize<CtrlDataJSON[]>(result.Response.Body, HandleSGNetworkEvent);
                }
                catch (Exception e)
                {
                    Log.Write(LogLevel.Warning, "Unexpected JSON response: " + e.ToString());
                    Wait(1);
                    ListenSGEvent();
                }
            }
            else
            {
                announced = false;
                DoReportState(GateState.Offline);
                Wait(1);
                ListenSGEvent();
            }

        }

        private void ListenSGEvent()
        {
            // If there's already a request in progress, do not place one on top.
            if (running) return;

            // If we've done everything we've been asked for and requested to go to sleep, do so.
            if (abortRequested && commandQueue.Count == 0)
            {
                abortRequested = false;
                return;
            }

            // If there's nothing in line, queue in the listener, and let it loop back in here.
            if(commandQueue.Count == 0)
            {
                if (!announced)
                {
                    Log.Write(LogLevel.Info, "Announcing gate: FQLID=" + thisGate.fqlid + ", number base=" + thisGate.numberBase);
                    QueueSGNCommand("announce", 10000, new RequestParams(){
                        { "base" , "" + thisGate.numberBase }
                    });
                }
                else if (_listenSGN && !thisGate.busy)
                    QueueSGNCommand("wait", 10000, null);

                return;
            }

            running = true;

            HttpRequestOptions options = commandQueue.Dequeue();

            string req = baseUrl + "/rest/httpctrl";

            ScenePrivate.HttpClient.Request(req, options, ParseSGEvent);
        }

        public void QueueSGNCommand(string command, int timeout, RequestParams payload)
        {
            HttpRequestOptions options = new HttpRequestOptions();

            if(payload == null) payload = new RequestParams();

            payload["command"] = command;
            payload["tmo"] = "" + timeout;
            payload["fqlid"] = thisGate.fqlid;
            options.Parameters = payload;
            commandQueue.Enqueue(options);
            ListenSGEvent();
        }

        public void DoGateDisconnect()
        {
            if (thisGate != null) thisGate.reset();
        }

        public void DoReportState(GateState state)
        {
            if (thisDHD != null) thisDHD.ReportState(state);
        }

        public override void Init()
        {
            ScenePrivate.User.Subscribe(User.AddUser, OnUserJoin);
            ScenePrivate.User.Subscribe(User.RemoveUser, OnUserLeave);
        }

        public void ConnectGate(IGate gate)
        {
            thisGate = gate;
        }

        public void ConnectDHD(IDHD dhd)
        {
            thisDHD = dhd;
        }

        private void OnInit()
        {
            if(thisGate == null)
            {
                // Delay initialization if the gate hasn't announced itself yet.
                if(!abortRequested)
                    Timer.Create(1.0, OnInit);
                return;
            }

            abortRequested = false;
            ListenSGEvent();
        }

        private void OnShutdown()
        {
            // Reset gate (if needed), announce its cessation of operation and stop the listener when everything is done.
            if(thisGate != null)
            {
                thisGate.reset();
                QueueSGNCommand("deannounce", 10000, null);
            }

            announced = false;
            abortRequested = true;
        }

        private void OnUserJoin(UserData user)
        {
            if (ScenePrivate.AgentCount == 1) OnInit();
        }

        private void OnUserLeave(UserData user)
        {
            if (ScenePrivate.AgentCount == 0) OnShutdown();
        }
    }
}
