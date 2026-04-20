import React, { useRef } from 'react';
import { Modal, View, Image, PanResponder, Animated, Dimensions, Text } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

function getTouchDist(t1: any, t2: any): number {
    return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
}

interface ImageZoomModalProps {
    visible: boolean;
    uri: string;
    onClose: () => void;
}

export function ImageZoomModal({ visible, uri, onClose }: ImageZoomModalProps) {
    const scale = useRef(new Animated.Value(1)).current;
    const tx    = useRef(new Animated.Value(0)).current;
    const ty    = useRef(new Animated.Value(0)).current;

    // Committed (saved) transform after each gesture ends
    const savedScale = useRef(1);
    const savedTx    = useRef(0);
    const savedTy    = useRef(0);

    // Working values updated during the current gesture
    const workScale  = useRef(1);
    const workTx     = useRef(0);
    const workTy     = useRef(0);

    const pinchDist0 = useRef(0);
    const moved      = useRef(false);

    // Keep onClose ref-stable so the PanResponder (created once) always
    // calls the latest version without stale closure.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const doReset = () => {
        scale.setValue(1);
        tx.setValue(0);
        ty.setValue(0);
        savedScale.current = 1;
        savedTx.current    = 0;
        savedTy.current    = 0;
        workScale.current  = 1;
        workTx.current     = 0;
        workTy.current     = 0;
    };

    const doClose = () => {
        doReset();
        onCloseRef.current();
    };
    const doCloseRef = useRef(doClose);
    doCloseRef.current = doClose;

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onMoveShouldSetPanResponderCapture: () => true,

        onPanResponderGrant: (e) => {
            moved.current      = false;
            workScale.current  = savedScale.current;
            workTx.current     = savedTx.current;
            workTy.current     = savedTy.current;
            const t = e.nativeEvent.touches;
            if (t.length >= 2) {
                pinchDist0.current = getTouchDist(t[0], t[1]);
            } else {
                pinchDist0.current = 0;
            }
        },

        onPanResponderMove: (e, gs) => {
            const t = e.nativeEvent.touches;
            if (t.length >= 2) {
                moved.current = true;
                const d = getTouchDist(t[0], t[1]);
                if (pinchDist0.current === 0) {
                    pinchDist0.current = d;
                    return;
                }
                const newScale = Math.max(1, Math.min(6, savedScale.current * (d / pinchDist0.current)));
                workScale.current = newScale;
                scale.setValue(newScale);
            } else {
                if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6) moved.current = true;
                if (savedScale.current > 1.01) {
                    const newTx = savedTx.current + gs.dx;
                    const newTy = savedTy.current + gs.dy;
                    workTx.current = newTx;
                    workTy.current = newTy;
                    tx.setValue(newTx);
                    ty.setValue(newTy);
                }
            }
        },

        onPanResponderRelease: (e, gs) => {
            if (!moved.current || (Math.abs(gs.dx) < 2 && Math.abs(gs.dy) < 2 && Math.abs(gs.vx) < 0.1)) {
                // If it was just a tap or very tiny movement, close
                doCloseRef.current();
                return;
            }
            // Snap back if over-zoomed out
            if (workScale.current <= 1.01) {
                doReset();
                return;
            }
            savedScale.current = workScale.current;
            savedTx.current    = workTx.current;
            savedTy.current    = workTy.current;
        },

        onPanResponderTerminate: () => {
            savedScale.current = workScale.current;
            savedTx.current    = workTx.current;
            savedTy.current    = workTy.current;
        },
    })).current;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => doCloseRef.current()}
            statusBarTranslucent
        >
            <View 
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}
                {...panResponder.panHandlers}
            >
                <Animated.View
                    style={{
                        width: SW,
                        height: SH * 0.78,
                        transform: [{ scale }, { translateX: tx }, { translateY: ty }],
                    }}
                >
                    <Image
                        source={{ uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                </Animated.View>

                <Text style={{
                    position: 'absolute',
                    bottom: 36,
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 12,
                    letterSpacing: 0.3,
                }}>
                    Pinch to zoom · Tap to close
                </Text>
            </View>
        </Modal>
    );
}
