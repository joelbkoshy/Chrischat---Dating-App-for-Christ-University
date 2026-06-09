import  { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { useAuth } from '../../src/context/AuthContext';
import { SOCKET_URL } from '../../src/services/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended';

export default function VideoCallScreen() {
  const { matchId, userId, userName, isIncoming, offer: incomingOffer } = useLocalSearchParams<{
    matchId: string;
    userId: string;
    userName: string;
    isIncoming?: string;
    offer?: string;
  }>();
  const { user } = useAuth();

  const [callState, setCallState] = useState<CallState>(isIncoming === 'true' ? 'ringing' : 'connecting');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCleanedUp = useRef(false);

  useEffect(() => {
    initCall();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const initCall = async () => {
    try {
      // Get local media stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      setLocalStream(stream);

      // Setup socket
      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.on('connect', () => {
        if (user?._id) socket.emit('user_online', user._id);
      });

      // Setup peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnection.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      (pc as any).ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            receiverId: userId,
            senderId: user?._id,
            candidate: event.candidate,
          });
        }
      };

      (pc as any).onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          endCall('Connection lost');
        }
      };

      // Socket event handlers
      socket.on('call_answered', async (data: { answer: any }) => {
        try {
          const remoteDesc = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(remoteDesc);
          // Process queued ICE candidates
          for (const candidate of iceCandidateQueue.current) {
            await pc.addIceCandidate(candidate);
          }
          iceCandidateQueue.current = [];
          setCallState('connected');
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      });

      socket.on('ice_candidate', async (data: { candidate: any }) => {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            iceCandidateQueue.current.push(candidate);
          }
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });

      socket.on('call_ended', () => {
        endCall('Call ended');
      });

      socket.on('call_rejected', (data: { reason: string }) => {
        endCall(data.reason === 'busy' ? 'User is busy' : 'Call declined');
      });

      socket.on('call_failed', (data: { reason: string }) => {
        endCall(data.reason);
      });

      // If outgoing call, create and send offer
      if (isIncoming !== 'true') {
        const offerDesc = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offerDesc);

        socket.emit('call_user', {
          receiverId: userId,
          callerId: user?._id,
          callerName: user?.name,
          callerPhoto: user?.photos?.[0] || '',
          matchId,
          offer: offerDesc,
        });
        setCallState('ringing');

        // Auto-end if no answer in 45 seconds
        setTimeout(() => {
          if (peerConnection.current?.connectionState !== 'connected') {
            endCall('No answer');
          }
        }, 45000);
      }

      // If incoming call, set remote description from offer
      if (isIncoming === 'true' && incomingOffer) {
        try {
          const offerDesc = new RTCSessionDescription(JSON.parse(incomingOffer));
          await pc.setRemoteDescription(offerDesc);
        } catch (err) {
          console.error('Error setting incoming offer:', err);
        }
      }
    } catch (err: any) {
      console.error('Call init error:', err);
      Alert.alert('Error', 'Failed to start call. Check camera/microphone permissions.');
      router.back();
    }
  };

  const answerCall = async () => {
    try {
      const pc = peerConnection.current;
      if (!pc) return;

      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);

      socketRef.current?.emit('call_answer', {
        callerId: userId,
        answer: answerDesc,
      });

      // Process queued ICE candidates
      for (const candidate of iceCandidateQueue.current) {
        await pc.addIceCandidate(candidate);
      }
      iceCandidateQueue.current = [];
      setCallState('connected');
    } catch (err) {
      console.error('Error answering call:', err);
      endCall('Failed to answer');
    }
  };

  const rejectCall = () => {
    socketRef.current?.emit('reject_call', {
      callerId: userId,
      reason: 'rejected',
    });
    cleanup();
    router.back();
  };

  const endCall = useCallback((reason?: string) => {
    socketRef.current?.emit('end_call', {
      receiverId: userId,
      reason: reason || 'ended',
    });
    setCallState('ended');
    cleanup();
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 1000);
  }, [userId]);

  const cleanup = () => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    socketRef.current?.disconnect();
    peerConnection.current = null;
    socketRef.current = null;
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const switchCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        (videoTrack as any)._switchCamera();
        setIsFrontCamera((prev) => !prev);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState) {
      case 'connecting': return 'Connecting...';
      case 'ringing': return isIncoming === 'true' ? 'Incoming call...' : 'Ringing...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
    }
  };

  // Incoming call - ringing UI
  if (callState === 'ringing' && isIncoming === 'true') {
    return (
      <View style={styles.incomingContainer}>
        <View style={styles.incomingInfo}>
          <View style={styles.callerAvatar}>
            <Ionicons name="person" size={48} color={COLORS.white} />
          </View>
          <Text style={styles.callerName}>{userName}</Text>
          <Text style={styles.incomingLabel}>Incoming Video Call</Text>
        </View>
        <View style={styles.incomingActions}>
          <TouchableOpacity style={[styles.actionCircle, styles.rejectButton]} onPress={rejectCall}>
            <Ionicons name="close" size={32} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCircle, styles.answerButton]} onPress={answerCall}>
            <Ionicons name="videocam" size={32} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote Video (Full Screen) */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <View style={styles.placeholderAvatar}>
            <Ionicons name="person" size={64} color={COLORS.white} />
          </View>
          <Text style={styles.placeholderName}>{userName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      )}

      {/* Local Video (Picture-in-Picture) */}
      {localStream && !isCameraOff && (
        <View style={styles.localVideoWrapper}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={isFrontCamera}
            zOrder={1}
          />
        </View>
      )}

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{userName}</Text>
          {callState === 'connected' && (
            <Text style={styles.callTimer}>{formatDuration(callDuration)}</Text>
          )}
          {callState !== 'connected' && (
            <Text style={styles.callStatus}>{getStatusText()}</Text>
          )}
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
          onPress={toggleCamera}
        >
          <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color={COLORS.white} />
          <Text style={styles.controlLabel}>{isCameraOff ? 'Camera Off' : 'Camera'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={COLORS.white} />
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Ionicons name="camera-reverse" size={24} color={COLORS.white} />
          <Text style={styles.controlLabel}>Flip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={() => endCall()}
        >
          <Ionicons name="call" size={28} color={COLORS.white} style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.controlLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Incoming call screen
  incomingContainer: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
  },
  incomingInfo: {
    alignItems: 'center',
  },
  callerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  callerName: {
    ...FONTS.h1,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  incomingLabel: {
    ...FONTS.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 60,
  },
  actionCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  answerButton: {
    backgroundColor: COLORS.success,
  },
  // Video views
  remoteVideo: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  placeholderAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  placeholderName: {
    ...FONTS.h2,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  statusText: {
    ...FONTS.medium,
    color: 'rgba(255,255,255,0.6)',
  },
  localVideoWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 10,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  callInfo: {
    alignItems: 'flex-start',
  },
  callName: {
    ...FONTS.h3,
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  callTimer: {
    ...FONTS.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  callStatus: {
    ...FONTS.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 50 : SPACING.xl,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlButton: {
    alignItems: 'center',
    gap: 6,
    padding: SPACING.sm,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.md,
  },
  controlLabel: {
    ...FONTS.caption,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  endCallButton: {
    backgroundColor: COLORS.error,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
});
