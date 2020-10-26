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
        public string error { get; set; }
        public string command { get; set; }
        public string tgtFqlid { get; set; }
        public string tgtSequence { get; set; }
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

        private string baseUrl = "http://bcb985f4f085.ngrok.io";

        private IGate thisGate = null;

        private string fqlid = null;
        private int numberBase = 0;

        private bool abortRequested = false;
        private bool running = false;

        private Queue<string> commandQueue = null;

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
                    thisGate.startSequence(jdi.tgtFqlid, jdi.tgtSequence, jdi.timestamp);
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
                Log.Write(LogLevel.Info, "SGNetwork event received: " + result.Response.Body);
                try
                {
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
                    QueueSGNCommand("wait", 10000, "");
                return;
            }

            running = true;

            string req = commandQueue.Dequeue();

            HttpRequestOptions options = new HttpRequestOptions();
            ScenePrivate.HttpClient.Request(req, options, ParseSGEvent);
        }

        public void QueueSGNCommand(string command, int timeout, string payloadString)
        {
            string reqline = baseUrl + "/rest/httpctrl?command=" + command + "&tmo=" + timeout + "&fqlid=" + fqlid;
            if (payloadString.Length > 0)
                reqline = reqline + "&" + payloadString;

            commandQueue.Enqueue(reqline);
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
            numberBase = thisGate.numberBase;
            commandQueue = new Queue<string>();

            abortRequested = false;
            running = false;

            ScenePrivate.User.Subscribe(User.AddUser, OnUserJoin);
            ScenePrivate.User.Subscribe(User.RemoveUser, OnUserLeave);
        }

        private void OnInit()
        {
            abortRequested = false;
            QueueSGNCommand("announce", 10000, "base=" + numberBase);

        }

        private void OnShutdown()
        {
            // Reset gate (if needed), announce its cessation of operation and stop the listener when everything is done.
            thisGate.reset();
            QueueSGNCommand("deannounce", 10000, "");
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
