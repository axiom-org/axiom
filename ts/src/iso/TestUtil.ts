import { useMockBasicPeer, useWebRTCBasicPeer } from "./BasicPeer";
import Peer from "./Peer";

export function useMockNetworking() {
  useMockBasicPeer();
}

export function useRealNetworking() {
  useWebRTCBasicPeer();
  Peer.intercept = {};
}
