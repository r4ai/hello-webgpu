import "./style.css";

const vertWGSL = `
// 頂点シェーダー
@vertex
fn main(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4<f32> {

  var pos = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5)
  );

  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
`;

const fragWGSL = `
// フラグメントシェーダー
@fragment
fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.5, 0.0, 0.0, 0.5);
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
  const g_adapter = await navigator.gpu.requestAdapter(); // 物理
  const g_device = await g_adapter?.requestDevice(); // 論理

  if (!g_device || !g_device) {
    console.error("Failed to get GPU device");
    return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: g_device,
    format: presentationFormat,
    // opaque: 背景透過なし
    // premultiplied: 背景透過あり
    alphaMode: "opaque",
  });

  // create a render pipeline
  // GPUの設定 (これが作り置きできて便利だね)
  const pipeline = g_device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: g_device.createShaderModule({
        code: vertWGSL,
      }),
      entryPoint: "main",
    },
    fragment: {
      module: g_device.createShaderModule({
        code: fragWGSL,
      }),
      entryPoint: "main",
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

  frame({ context, pipeline });

  interface FrameProps {
    context: GPUCanvasContext;
    pipeline: GPURenderPipeline;
  }
  async function frame({ context, pipeline }: FrameProps) {
    // commandBuffer
    const commandEncoder = g_device?.createCommandEncoder();

    // 描画先のRenderTargetTexture
    // (描画先のCanvasのBackBuffer)
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 0,
          },
          loadOp: "clear", // 描画前の処理 (バッファクリアする)
          storeOp: "store", // 描画後の処理 (保持)
        },
      ],
    };

    const passEncoder = commandEncoder?.beginRenderPass(renderPassDescriptor);
    passEncoder?.setPipeline(pipeline);

    // プリミティブを描画
    // param vertexCount - 描画する頂点の数
    // param instanceCount - 描画するインスタンスの数
    // param firstVertex - 描画を開始する頂点バッファ内のオフセット(頂点単位)
    // param firstInstance - 描画する最初のインスタンス
    passEncoder?.draw(3, 1, 0, 0);
    passEncoder?.end();

    if (!commandEncoder) {
      console.error("Failed to create commandEncoder");
      return;
    }
    g_device?.queue.submit([commandEncoder.finish()]);
    console.info("Hello, WebGPU!");
  }
}

window.addEventListener("DOMContentLoaded", init);
