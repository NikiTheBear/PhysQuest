import {appearanceSchema as appearance} from '../shared/appearance.js';
import { CATALOG, COUPLINGS } from '../shared/catalog.js';
const str={type:'string'},num={type:'number'},obj={type:'object'},bool={type:'boolean'};
const id={experimentId:{type:'string',description:'实验 ID；省略时使用当前打开的实验。'}};
const pos={type:'array',items:num,minItems:3,maxItems:3,description:'[x,y,z]，单位 m；各轴 -30 到 30。'};
const collider={type:'object',description:'机械碰撞范围。auto 随器具形状；box 使用 size 完整宽高深，单位 m；offset 是局部中心偏移。非刚体器具作为固定障碍，场/力源/两端连接/音圈不支持。',properties:{enabled:bool,shape:{type:'string',enum:['auto','box']},size:{type:'array',items:{type:'number',minimum:.02,maximum:60},minItems:3,maxItems:3},offset:{type:'array',items:{type:'number',minimum:-30,maximum:30},minItems:3,maxItems:3}},required:['enabled','shape','size','offset'],additionalProperties:false};
const part={type:'object',properties:{id:str,kind:{type:'string',enum:Object.keys(CATALOG)},name:str,position:pos,params:obj,refs:obj,fixed:bool,appearance,collider},required:['id','kind'],additionalProperties:false};
const assembly={components:{type:'array',items:part,minItems:1,maxItems:24},connections:{type:'array',items:{type:'object',properties:{kind:{type:'string',enum:Object.keys(COUPLINGS)},source:str,target:str,sourcePort:str,targetPort:str,gain:num},required:['kind','source','target']}},ports:{type:'array',items:{type:'object',properties:{name:str,componentId:str,port:{type:'string',enum:['a','b']}},required:['name','componentId','port']}},bindings:{type:'object',additionalProperties:{type:'object',properties:{componentId:str,parameter:str},required:['componentId','parameter']}}};
const kinds={type:'string',enum:Object.keys(CATALOG)};
const tool=(name,description,properties,required=[],readOnly=false)=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:false}});
export const TOOLS=[
  tool('set_variable_slider','在器具库下方添加或更新实验变量滑块，拖动即调节物理参数。同一绑定复用已有滑块。提供 componentId 与器具数值参数名；省略 componentId 时可绑定环境 gravity、damping、speed。范围与步长默认采用模型定义，remove=true 移除。',{...id,componentId:str,parameter:str,label:str,min:num,max:num,step:num,remove:bool},['parameter']),
  tool('plot_chart','在实验台下方绘制并显示真实仿真采样的时间曲线。从当前初始条件独立计算；channels 使用 simulate_experiment 的 readings.channels 的完整键，机械能用 energy。可比较最多四条同单位曲线。',{...id,title:str,duration:{type:'number',minimum:.02,maximum:20},channels:{type:'array',items:str,minItems:1,maxItems:4}},['channels']),
  tool('list_knowledge_prompts','分页查找知识地图的全部规划知识点实验提示词。direct=可计算，approximation=近似或类比，conceptual=概念示意。不能把提示词存在当成求解器支持。',{query:str,domain:{type:'string',enum:['mechanics','electromagnetism','optics','thermodynamics','modern']},stage:{type:'string',enum:['primary','junior','senior','university']},support:{type:'string',enum:['direct','approximation','conceptual']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:50}},[],true),
  tool('get_knowledge_prompt','读取一个知识点的完整搭建提示词，包括目标、器具、可调变量、观测量和模型边界。之后请真实调用工具新建空间并搭建。',{knowledgeId:str},['knowledgeId'],true),
  tool('get_workspace','读取当前用户的所有实验空间、当前选中空间、器具、连接、目标、模式和修订号。新空间默认完全空白。',{},[],true),
  tool('list_instruments','查看可用器具、每个参数的默认值/单位/范围、可连接的类型和自定义器具。先调用此工具再设计实验。',{},[],true),
  tool('list_experiment_files','列出已转存为 physquest.experiment v1 JSON 的原版 PhysQuest 实验；只读，不自动切换当前空间。',{},[],true),
  tool('load_experiment_file','将一个原版实验文件载入新的可编辑空间；保留现有空间。之后可用 update_component / update_experiment 修改，不受原版关卡限制。',{fileId:str},['fileId']),
  tool('import_experiment','载入 physquest.experiment v1 JSON 文件（也兼容旧版 Fieldlab 配置），创建新的可编辑空间。自动重建 ID 与连接，暂停运行。',{file:obj},['file']),
  tool('export_experiment','把当前或指定空间导出为 physquest.experiment v1 JSON 文件对象，保留器具、参数、目标、连接与原版教学信息。',id,[],true),
  tool('create_experiment','创建并打开一个空白实验空间。不会添加任何器具。',{title:str,goal:str,mode:{type:'string',enum:['2d','3d']}},['title']),
  tool('activate_experiment','打开已有实验空间，网页会自动同步。',id,['experimentId']),
  tool('update_experiment','修改实验名称、目标、2D/3D 模式和环境参数。重力单位 m/s²，damping 单位 kg/s，speed 为播放倍率（0.05–4），慢放可选 0.25。',{...id,title:str,goal:str,learning:{type:'object',description:'可编辑教学说明、预测问题与参考条件；只作为说明，不锁定操作。'},mode:{type:'string',enum:['2d','3d']},environment:{type:'object',properties:{gravity:{type:'number',minimum:0,maximum:25},damping:{type:'number',minimum:0,maximum:5},speed:{type:'number',minimum:.1,maximum:4},collisions:bool},additionalProperties:false}}),
  tool('add_component','添加一个真实参与计算的器具。参数名与取值范围先查 list_instruments；返回组件 ID。spring/rope/rod/damper 的 refs.a,b 连接 body/charge/box/cylinder/anchor；expression_force 使用 params.fx/fy/fz 字符串（如 -0.3*vx），drag 使用 linear/quadratic 阻力系数；force/drag/expression_force/harmonic_force/motion_sensor 的 refs.target 连接运动刚体。',{...id,kind:kinds,name:str,position:pos,params:obj,fixed:bool,refs:obj,appearance,collider},['kind']),
  tool('update_component','修改器具参数、名称、固定状态、位置或弹簧端点。未给出的参数保持不变；网页重新开始计时。',{...id,componentId:str,name:str,position:pos,params:obj,fixed:bool,refs:obj,appearance,collider},['componentId']),
  tool('remove_component','移除指定器具，并清除引用它的连接和弹簧端点。',{...id,componentId:str},['componentId']),
  tool('connect_components','连接器具。wire 为电路导线，指定 sourcePort、targetPort 为 a/b；electrical 将信号/电路电流驱动音圈；acoustic、optical 是振动发声和光强调制。',{...id,kind:{type:'string',enum:Object.keys(COUPLINGS)},source:str,target:str,sourcePort:{type:'string',enum:['a','b']},targetPort:{type:'string',enum:['a','b']},gain:{type:'number',minimum:-20,maximum:20}},['kind','source','target']),
  tool('disconnect_components','移除跨物理过程连接。',{...id,connectionId:str},['connectionId']),
  tool('design_component','制作单个自定义器具：保存基础物理模型、参数、颜色和固定状态。之后必须调用 instantiate_design 才会放进实验。不是预设实验，不接受任意代码。',{name:str,kind:kinds,params:obj,description:str,fixed:bool,appearance,collider},['name','kind']),
  tool('design_assembly','制作可复用组合器具：1–24 个部件、内部连接、公开电路端子与可调参数。部件 id 为本设计内唯一的局部 ID；position 为相对放置原点的坐标，refs/连接引用这些局部 ID。ports 公开电路端子；bindings 将参数名映射到部件的参数。创建后通过 instantiate_design 放置。',{name:str,description:str,...assembly},['name','components']),
  tool('instantiate_design','把自定义器具放入目标空间，自动重建内部连接和 ID。position 为放置原点；parameters 覆盖单器具参数或组合器具 bindings 中的公开参数。返回部件 ID 和 ports，可继续与外部电路接线。',{...id,designId:str,position:pos,name:str,parameters:obj},['designId']),
  tool('update_design','更新器具库中的设计。已有场景中的副本不变；组合器具修改结构时提交完整 components/connections/ports/bindings。',{designId:str,name:str,description:str,params:obj,fixed:bool,appearance,collider,...assembly},['designId']),
  tool('remove_design','从器具库移除自定义设计，已放入空间的副本仍然保留。',{designId:str},['designId']),
  tool('control_simulation','控制网页运行/暂停，或 reset=true 重置计时与初始条件。',{...id,running:bool,reset:bool,speed:{type:'number',minimum:.05,maximum:4}}),
  tool('simulate_experiment','从初始条件进行数值计算，返回真实测量值、采样数据、物体位置及模型局限。独立于网页动画，最长 20 秒，最多 1200 样本。',{...id,duration:{type:'number',minimum:.02,maximum:20},sampleRate:{type:'number',minimum:1,maximum:60}},[],true)
];
