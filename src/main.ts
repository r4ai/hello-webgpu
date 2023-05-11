import "./style.css";

const shader = `
struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>
}

// 頂点シェーダー
@vertex
fn vertexShader(@location(0) position: vec4<f32>,
               @location(1) color: vec4<f32>) -> VertexOut {
  var output : VertexOut;
  output.position = position;
  output.color = color;
  return output;
}

// フラグメントシェーダー
@fragment
fn fragmentShader(fragData: VertexOut) -> @location(0) vec4<f32> {
  return fragData.color;
}
`;

async function init() {
  const canvas = document.getElementById("webgpuCanvas") as any;
  const context = canvas?.getContext("webgpu") as GPUCanvasContext;

  if (!context) {
    console.error("WebGPU not supported");
    return;
  } else {
    console.info("Start initializing WebGPU...");
  }

  // get device
  const adapter = await navigator.gpu.requestAdapter(); // 物理
  const device = await adapter?.requestDevice(); // 論理

  if (!device || !device) {
    console.error("Failed to get GPU device");
    return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: presentationFormat,
    // opaque: 背景透過なし
    // premultiplied: 背景透過あり
    alphaMode: "premultiplied",
  });

  /* prettier-ignore */
  // 前半4個が頂点座標(x,y,z,w)、後半4個が色情報(c_x,x_y,c_z,c_w)
  // 合計で3頂点分のデータがある
  const vertices = new Float32Array([
    0.0,  0.6, 0, 1,    1, 0, 0, 1,
   -0.5, -0.6, 0, 1,    0, 1, 0, 1,
    0.5, -0.6, 0, 1,    0, 0, 1, 1,
 ]);
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    // buffer will be used as a vertex buffer and the destination of copy operations.
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

  // create a render pipeline
  // GPUの設定 (これが作り置きできて便利だね)
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: shader,
      }),
      entryPoint: "vertexShader",
      buffers: [
        {
          attributes: [
            {
              shaderLocation: 0, // position
              offset: 0,
              format: "float32x4",
            },
            {
              shaderLocation: 1,
              offset: 4 * 4,
              format: "float32x4",
            },
          ],
          // 各頂点を構成するデータのサイズ [bytes]
          // 頂点座標(x,y,z,w) + 色情報(c_x,x_y,c_z,c_w) = 4 * 4 + 4 * 4 = 32 bytes
          arrayStride: 32,
          stepMode: "vertex",
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({
        code: shader,
      }),
      entryPoint: "fragmentShader",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  frame(context, pipeline);

  async function frame(context: GPUCanvasContext, pipeline: GPURenderPipeline) {
    // commandBuffer
    const commandEncoder = device?.createCommandEncoder();

    // 描画先のRenderTargetTexture
    // (描画先のCanvasのBackBuffer)
    const textureView = context.getCurrentTexture().createView();

    const clearColor = { r: 0.0, g: 0.5, b: 1.0, a: 1.0 };

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          clearValue: clearColor,
          loadOp: "clear",
          storeOp: "store",
          view: textureView,
        },
      ],
    };

    const passEncoder = commandEncoder?.beginRenderPass(renderPassDescriptor);
    passEncoder?.setPipeline(pipeline);
    passEncoder?.setVertexBuffer(0, vertexBuffer);

    // プリミティブを描画
    // param vertexCount - 描画する頂点の数
    // param instanceCount - 描画するインスタンスの数
    // param firstVertex - 描画を開始する頂点バッファ内のオフセット(頂点単位)
    // param firstInstance - 描画する最初のインスタンス
    passEncoder?.draw(3);
    passEncoder?.end();

    if (!commandEncoder) {
      console.error("Failed to create commandEncoder");
      return;
    }
    device?.queue.submit([commandEncoder.finish()]);
    console.info("Hello, WebGPU!");
  }
}

window.addEventListener("DOMContentLoaded", init);
