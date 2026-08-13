/**
 * MediaPipe 面部追踪封装模块
 * 负责：初始化模型、实时推理、情绪估测、数据存储
 *
 * 使用 @mediapipe/tasks-vision 的 FaceLandmarker
 * 输出 468 个面部 landmark + 52 个 blendshape 系数
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let faceLandmarker = null
let videoElement = null
let isRunning = false
let lastCaptureTime = 0
let onResultCallback = null

// 配置
const CONFIG = {
  captureInterval: 200,    // 存储间隔 200ms = 5fps
  modelPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
}

/**
 * 初始化 FaceLandmarker
 * @returns {Promise<boolean>} 是否初始化成功
 */
export const initMediaPipe = async () => {
  if (faceLandmarker) return true

  try {
    const vision = await FilesetResolver.forVisionTasks(CONFIG.wasmPath)
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: CONFIG.modelPath,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false
    })
    console.log('[MediaPipe] 初始化成功')
    return true
  } catch (err) {
    console.error('[MediaPipe] 初始化失败:', err)
    // 降级到 CPU
    try {
      const vision = await FilesetResolver.forVisionTasks(CONFIG.wasmPath)
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: CONFIG.modelPath,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true
      })
      console.log('[MediaPipe] CPU 模式初始化成功')
      return true
    } catch (err2) {
      console.error('[MediaPipe] CPU 模式也失败:', err2)
      return false
    }
  }
}

/**
 * 获取摄像头视频流
 * @returns {Promise<MediaStream|null>}
 */
export const getCameraStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    })
    return stream
  } catch (err) {
    console.error('[MediaPipe] 摄像头获取失败:', err)
    return null
  }
}

/**
 * 开始实时面部检测
 * @param {HTMLVideoElement} video - 视频元素
 * @param {Function} onResult - 每帧结果回调
 * @returns {Promise<boolean>}
 */
export const startTracking = async (video, onResult) => {
  if (!faceLandmarker) {
    const ok = await initMediaPipe()
    if (!ok) return false
  }

  videoElement = video
  onResultCallback = onResult || null
  isRunning = true
  lastCaptureTime = 0

  // 确保视频在播放
  if (video.paused) {
    await video.play()
  }

  detectFrame()
  return true
}

/**
 * 停止追踪
 */
export const stopTracking = () => {
  isRunning = false
  videoElement = null
  onResultCallback = null
}

/**
 * 单帧检测循环
 */
const detectFrame = () => {
  if (!isRunning || !videoElement || !faceLandmarker) return

  const now = performance.now()
  const timestamp = Date.now()

  // 只在视频有数据时推理
  if (videoElement.readyState >= 2) {
    try {
      const results = faceLandmarker.detectForVideo(videoElement, timestamp)

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0] // 468 个点
        const blendshapes = results.faceBlendshapes?.[0]?.categories || []

        // 估测情绪
        const emotion = estimateEmotion(blendshapes)

        // 回调
        if (onResultCallback) {
          onResultCallback({
            landmarks,
            blendshapes,
            emotion,
            timestamp,
            faceDetected: true
          })
        }
      } else {
        // 未检测到面部
        if (onResultCallback) {
          onResultCallback({
            landmarks: null,
            blendshapes: [],
            emotion: { label: 'No Face', value: 0 },
            timestamp,
            faceDetected: false
          })
        }
      }
    } catch (err) {
      // 推理错误不影响后续帧
    }
  }

  // 下一帧
  requestAnimationFrame(detectFrame)
}

/**
 * 基于 blendshape 系数估测情绪
 * @param {Array} blendshapes - MediaPipe blendshape 数组
 * @returns {{label: string, value: number, raw: Object}}
 */
export const estimateEmotion = (blendshapes) => {
  if (!blendshapes || blendshapes.length === 0) {
    return { label: 'Neutral', value: 0.1, raw: {} }
  }

  // 提取关键 blendshape 分数
  const scores = {}
  blendshapes.forEach(b => {
    scores[b.categoryName] = b.score
  })

  // 情绪估测算法
  const emotions = {
    Confusion: (scores.browDownLeft || 0) * 0.3 +
               (scores.browDownRight || 0) * 0.3 +
               (scores.browOuterUpLeft || 0) * 0.2 +
               (scores.browOuterUpRight || 0) * 0.2,

    Surprise: (scores.eyeWideLeft || 0) * 0.3 +
              (scores.eyeWideRight || 0) * 0.3 +
              (scores.jawOpen || 0) * 0.4,

    Frustration: (scores.mouthPucker || 0) * 0.3 +
                 (scores.mouthFrownLeft || 0) * 0.25 +
                 (scores.mouthFrownRight || 0) * 0.25 +
                 (scores.browDownLeft || 0) * 0.1 +
                 (scores.browDownRight || 0) * 0.1,

    Focus: (scores.browDownLeft || 0) * 0.2 +
           (scores.browDownRight || 0) * 0.2 +
           Math.max(0, 1 - (scores.eyeWideLeft || 0)) * 0.3 +
           (scores.eyeLookInLeft || 0) * 0.15 +
           (scores.eyeLookInRight || 0) * 0.15,

    Neutral: 0.1 // 基线
  }

  // 找出最高分的情绪
  let maxEmotion = 'Neutral'
  let maxValue = 0.1
  Object.entries(emotions).forEach(([name, value]) => {
    if (value > maxValue) {
      maxValue = value
      maxEmotion = name
    }
  })

  return {
    label: maxEmotion,
    value: Math.min(1, maxValue),
    raw: scores
  }
}

/**
 * 保存面部帧数据到 localStorage
 * @param {string} sessionId - 会话 ID
 * @param {Object} frame - 帧数据 { landmarks, emotion, timestamp }
 */
export const saveFrame = (sessionId, frame) => {
  try {
    const key = `mediapipe-frames-${sessionId}`
    let frames = []
    try {
      frames = JSON.parse(localStorage.getItem(key) || '[]')
    } catch { frames = [] }

    const simplifiedFrame = {
      t: frame.timestamp,
      emotion: frame.emotion,
      keyPoints: frame.landmarks ? getKeypoints(frame.landmarks) : null,
      faceDetected: frame.faceDetected,
      // 仅保存派生特征，不保存原始视频或截图。
    }

    frames.push(simplifiedFrame)

    // 限制最大帧数（20s × 5fps = 100 帧）
    if (frames.length > 100) {
      frames = frames.slice(-100)
    }

    localStorage.setItem(key, JSON.stringify(frames))

    // 更新索引
    const indexKey = 'mediapipe-session-index'
    let index = []
    try {
      index = JSON.parse(localStorage.getItem(indexKey) || '[]')
    } catch { index = [] }

    const existingIdx = index.findIndex(s => s.id === sessionId)
    const meta = {
      id: sessionId,
      frameCount: frames.length,
      lastEmotion: frame.emotion,
      updatedAt: Date.now()
    }
    if (existingIdx >= 0) {
      index[existingIdx] = meta
    } else {
      index.unshift(meta)
    }
    localStorage.setItem(indexKey, JSON.stringify(index))

    return true
  } catch (e) {
    console.error('[MediaPipe] 保存帧失败:', e)
    return false
  }
}

/**
 * 获取关键点（10 个核心位置用于渲染）
 */
const getKeypoints = (landmarks) => {
  // MediaPipe 关键点索引
  const KEY_INDICES = {
    leftEye: 33,      // 左眼外角
    rightEye: 263,    // 右眼外角
    nose: 4,          // 鼻尖
    leftBrow: 105,    // 左眉
    rightBrow: 334,   // 右眉
    upperLip: 13,     // 上唇
    lowerLip: 14,     // 下唇
    leftCheek: 234,   // 左脸颊
    rightCheek: 454,  // 右脸颊
    chin: 152         // 下巴
  }

  const points = {}
  Object.entries(KEY_INDICES).forEach(([name, idx]) => {
    const lm = landmarks[idx]
    if (lm) {
      points[name] = { x: lm.x, y: lm.y, z: lm.z }
    }
  })
  return points
}

/**
 * 从 localStorage 读取面部帧
 * @param {string} sessionId
 * @returns {Array}
 */
export const loadFrames = (sessionId) => {
  try {
    return JSON.parse(localStorage.getItem(`mediapipe-frames-${sessionId}`) || '[]')
  } catch {
    return []
  }
}

/**
 * 检查是否有面部数据
 */
export const hasFaceData = (sessionId) => {
  if (sessionId) {
    return !!localStorage.getItem(`mediapipe-frames-${sessionId}`)
  }
  const index = JSON.parse(localStorage.getItem('mediapipe-session-index') || '[]')
  return index.length > 0
}

/**
 * 获取会话索引
 */
export const getFaceSessionIndex = () => {
  try {
    return JSON.parse(localStorage.getItem('mediapipe-session-index') || '[]')
  } catch {
    return []
  }
}
