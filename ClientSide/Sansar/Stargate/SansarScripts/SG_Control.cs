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
    using RequestParams = Dictionary<string, string>;

    public class CtrlDataJSON
    {
        public string status { get; set; }
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

        #endregion

//        private string baseUrl = "https://abf13f2d5b6b.ngrok.io";
        private string baseUrl = "http://willneedit-mre.ddnsup.com";

        private IGate thisGate = null;

        private string fqlid = null;

        private bool abortRequested = false;
        private bool running = false;

        private Queue<HttpRequestOptions> commandQueue = null;

        private void HandleSGNetworkEvent(JsonSerializationData<CtrlDataJSON[]> obj)
        {
            CtrlDataJSON[] jd = obj.Object;
            foreach(var jdi in jd)
            {
                if (jdi.status != null)
                {
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
                Log.Write(LogLevel.Error, "Error while sending request: " + result.Exception + ", " + result.Message);
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
                if (_listenSGN && !thisGate.busy)
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
            // string reqline = baseUrl + "/rest/httpctrl?command=" + command + "&tmo=" + timeout + "&fqlid=" + fqlid;
            // if (payloadString.Length > 0)
            //     reqline = reqline + "&" + payloadString;

            HttpRequestOptions options = new HttpRequestOptions();

            if(payload == null) payload = new RequestParams();

            payload["command"] = command;
            payload["tmo"] = "" + timeout;
            payload["fqlid"] = fqlid;
            options.Parameters = payload;
            commandQueue.Enqueue(options);
            ListenSGEvent();
        }

        public override void Init()
        {
            thisGate = ScenePrivate.FindReflective<IGate>("Stargate.SG_Gate").FirstOrDefault();

            if(thisGate == null)
            {
                Log.Write(LogLevel.Error, "Gate not found in scene.");
                return;
            }

            fqlid = thisGate.fqlid;
            commandQueue = new Queue<HttpRequestOptions>();

            abortRequested = false;
            running = false;

            ScenePrivate.User.Subscribe(User.AddUser, OnUserJoin);
            ScenePrivate.User.Subscribe(User.RemoveUser, OnUserLeave);
        }

        private void OnInit()
        {
            Log.Write(LogLevel.Info, "Announcing gate: FQLID=" + fqlid + ", number base=" + thisGate.numberBase);
            abortRequested = false;
            QueueSGNCommand("announce", 10000, new RequestParams(){
                { "base" , "" + thisGate.numberBase }
            });

        }

        private void OnShutdown()
        {
            // Reset gate (if needed), announce its cessation of operation and stop the listener when everything is done.
            thisGate.reset();
            QueueSGNCommand("deannounce", 10000, null);
            abortRequested = true;
        }

        private void OnUserJoin(UserData user)
        {
            Log.Write(LogLevel.Info, "Agent entered, now " + ScenePrivate.AgentCount);
            if (ScenePrivate.AgentCount == 1) OnInit();
        }

        private void OnUserLeave(UserData user)
        {
            Log.Write(LogLevel.Info, "Agent leaving, now " + ScenePrivate.AgentCount);
            if (ScenePrivate.AgentCount == 0) OnShutdown();
        }
    }
}
