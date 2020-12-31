/*
 * Event Horizon script
 */

using Sansar.Script;
using Sansar.Simulation;
using Sansar.Utility;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Stargate
{
    [RegisterReflective]
    public class SG_EventHorizon : SceneObjectScript, IEventHorizon
    {
        #region EditorProperties

        [DefaultValue("Closed")]
        public Interaction HorizonTeleporter;
        
        #endregion

        private AnimationComponent animationComponent = null;
        private Animation anim_base = null;
        private Animation anim_open = null;
        private Animation anim_close = null;

        private string targetURI = "";

        private List<MeshComponent> meshes = new List<MeshComponent>();

        public override void Init()
        {
            for(uint i = 0; i < ObjectPrivate.GetComponentCount(ComponentType.MeshComponent); i++)
                meshes.Add((MeshComponent) ObjectPrivate.GetComponent(ComponentType.MeshComponent, i));

            animationComponent = (AnimationComponent) ObjectPrivate.GetComponent(ComponentType.AnimationComponent, 0);

            if((anim_base = animationComponent.GetAnimation("EventHorizon")) == null)
                Log.Write(LogLevel.Error, "Animation 'EventHorizon' (base animation) not found.");
            
            if((anim_open = animationComponent.GetAnimation("EventHorizon_Open")) == null)
                Log.Write(LogLevel.Error, "Animation 'EventHorizon_Open' (opening animation) not found.");

            if((anim_close = animationComponent.GetAnimation("EventHorizon_Close")) == null)
                Log.Write(LogLevel.Error, "Animation 'EventHorizon_Close' (closing animation) not found.");

            if(anim_base == null || anim_open == null || anim_close == null)
                return;

            foreach(MeshComponent mesh in meshes)
                mesh.SetIsVisible(false);

            HorizonTeleporter.SetEnabled(false);
            HorizonTeleporter.Subscribe(TeleportAgent);

// DEBUG CODE
#if false
            ScenePrivate.Chat.Subscribe(0, Chat.User, OnChat);
        }

        private void OnChat(ChatData data)
        {
            AgentPrivate agent = ScenePrivate.FindAgent(data.SourceId);
            string[] argv = data.Message.Split(' ');

            if(agent == null) return;
            
            if(argv[0] == "/open")
            {
                Open(argv[1]);
            }
            else if(argv[0] == "/close")
            {
                Close();
            }
#endif
        }

        public void Open(string fqlid)
        {
            foreach(MeshComponent mesh in meshes)
                mesh.SetIsVisible(true);

            AnimationParameters ap = anim_open.GetParameters();
            ap.PlaybackMode = AnimationPlaybackMode.PlayOnce;

            anim_open.Play(ap);
            Timer.Create(1.0, () =>
            {
                anim_base.Play();

                // null means it's an incoming wormhole. No travelling in wrong direction.
                if(fqlid != null)
                {
                    targetURI = Common.translateFQLIDToURL(fqlid);

                    HorizonTeleporter.SetEnabled(true);
                    HorizonTeleporter.SetPrompt("To " + targetURI);
                }
            });
        }

        public void Close()
        {
            HorizonTeleporter.SetEnabled(false);
            HorizonTeleporter.SetPrompt("Closed");

            AnimationParameters ap = anim_close.GetParameters();
            ap.PlaybackMode = AnimationPlaybackMode.PlayOnce;

            anim_close.Play(ap);
            Timer.Create(2.0, () =>
            {
                foreach(MeshComponent mesh in meshes)
                    mesh.SetIsVisible(false);
                
                anim_open.Reset();
                anim_close.Reset();
            });
        }

        public void TeleportAgent(InteractionData data)
        {
            AgentPrivate agent = ScenePrivate.FindAgent(data.AgentId);
            if(agent == null) return;

            if(targetURI.Substring(0,7) != "sansar:")
            {
                Log.Write(LogLevel.Warning, "Cross-realm teleport not yet supported.");
                return;
            }

            agent.Client.TeleportToUri(targetURI);
        }
    }
}