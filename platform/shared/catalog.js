export const DOMAINS = {
  mechanics: { name: '力学', color: '#efad6e', symbol: '↗' },
  acoustics: { name: '声学', color: '#bc9aff', symbol: '≋' },
  optics: { name: '光学', color: '#f0d77b', symbol: '⌁' },
  electricity: { name: '电学', color: '#6bbcff', symbol: 'ϟ' },
  magnetism: { name: '磁学', color: '#ec91b8', symbol: '⊂' },
  circuit: { name: '电路', color: '#408bd3', symbol: '⊕' },
  sensors: { name: '测量', color: '#79d7b7', symbol: '⌖' },
  thermodynamics: { name: '热学', color: '#e2a06b', symbol: '🌡' }
};
const p = (label, value, min, max, step, unit = '') => ({ label, value, min, max, step, unit });
const motion = { mass:p('质量',1,.01,100,.01,'kg'),vx:p('初速度 X',0,-20,20,.1,'m/s'),vy:p('初速度 Y',0,-20,20,.1,'m/s'),vz:p('初速度 Z',0,-20,20,.1,'m/s') };
export const CATALOG = {
  lens_bench: { name: '凸透镜光具座', domain: 'optics', icon: 'lens', description: 'PhysQuest 原版薄透镜成像模型；器具示意图，内部参数单位 cm，可编辑物距、焦距、物高、光屏与遮挡', params: { u:p('物距',30,.1,100,.1,'cm'), f:p('焦距',10,.1,40,.1,'cm'), h:p('物高',2.5,.1,10,.1,'cm'), screenX:p('光屏位置',15,0,150,.1,'cm'), lensDiameter:p('透镜口径',6,.1,20,.1,'cm'), maskTop:p('遮住上半部（0关/1开）',0,0,1,1), objectShape:p('物体（0箭头/1字母F/2蜡烛）',0,0,2,1) } },
  body: { name: '刚体球', domain: 'mechanics', icon: 'sphere', description: '质量、重力与弹性碰撞', params: { mass: p('质量', 1, .01, 100, .01, 'kg'), radius: p('半径', .3, .05, 1.5, .01, 'm'), restitution: p('恢复系数', .8, 0, 1, .01), vx: p('初速度 X', 0, -20, 20, .1, 'm/s'), vy: p('初速度 Y', 0, -20, 20, .1, 'm/s'), vz: p('初速度 Z', 0, -20, 20, .1, 'm/s') } },
  anchor: { name: '固定支点', domain: 'mechanics', icon: 'anchor', description: '弹簧的固定端与空间参考', params: {} },
  spring: { name: '弹簧', domain: 'mechanics', icon: 'spring', description: '连接两物体，施加胡克力', refs: ['a', 'b'], params: { stiffness: p('劲度系数', 15, .1, 200, .1, 'N/m'), restLength: p('原长', 1.5, .1, 8, .05, 'm'), damping: p('阻尼', .2, 0, 5, .01, 'N·s/m') } },
  speaker: { name: '点声源', domain: 'acoustics', icon: 'sound', description: '球面波与线性声场叠加', params: { frequency: p('频率', 120, 20, 2000, 1, 'Hz'), amplitude: p('参考声压', .5, 0, 2, .01, 'Pa'), phase: p('相位', 0, -180, 180, 1, '°'), speed: p('传播速度', 343, 50, 1500, 1, 'm/s') } },
  laser: { name: '激光光源', domain: 'optics', icon: 'laser', description: '平行光束与光强调制', params: { angle: p('光轴角度', 0, -180, 180, 1, '°'), power: p('光功率', 1, 0, 10, .1, 'mW'), wavelength: p('波长', 532, 380, 750, 1, 'nm'), width: p('束宽', .2, .001, .8, .001, 'm') } },
  lens: { name: '薄透镜', domain: 'optics', icon: 'lens', description: '近轴薄透镜模型', params: { focal: p('焦距', 1.5, .005, 8, .001, 'm'), radius: p('孔径半径', .7, .001, 2, .001, 'm'), angle: p('光轴角度', 0, -180, 180, 1, '°') } },
  mirror: { name: '平面镜', domain: 'optics', icon: 'mirror', description: '遵循反射定律的反射面', params: { angle: p('法线角度', 30, -180, 180, 1, '°'), radius: p('半径', .7, .1, 2, .05, 'm') } },
  charge: { name: '带电粒子', domain: 'electricity', icon: 'charge', description: '库仑相互作用与洛伦兹力', params: { charge: p('电荷量', 5, -50, 50, .1, 'μC'), mass: p('质量', .1, .01, 10, .01, 'kg'), radius: p('半径', .15, .05, .6, .01, 'm'), vx: p('初速度 X', 1, -20, 20, .1, 'm/s'), vy: p('初速度 Y', 0, -20, 20, .1, 'm/s'), vz: p('初速度 Z', 0, -20, 20, .1, 'm/s') } },
  power: { name: '信号电源', domain: 'electricity', icon: 'power', description: '正弦电流，驱动音圈', params: { current: p('电流幅值', 1, 0, 10, .05, 'A'), frequency: p('驱动频率', 2, 0, 30, .1, 'Hz'), phase: p('相位', 0, -180, 180, 1, '°') } },
  field: { name: '匀强磁场', domain: 'magnetism', icon: 'magnet', description: '球形作用区内的均匀磁场', params: { strength: p('磁感应强度', .5, -10, 10, .05, 'T'), radius: p('作用区半径', 3, .5, 10, .1, 'm'), axis: p('方向 0=X 1=Y 2=Z', 2, 0, 2, 1) } },
  coil: { name: '弹性音圈', domain: 'magnetism', icon: 'coil', description: '电流×磁场 → 有阻尼机械振动', params: { mass: p('运动质量', .2, .01, 10, .01, 'kg'), stiffness: p('悬挂刚度', 20, .1, 200, .1, 'N/m'), damping: p('机械阻尼', .4, .01, 5, .01, 'N·s/m'), length: p('有效导线长度', 2, .1, 10, .1, 'm'), displacement: p('初始位移', 0, -1, 1, .01, 'm') } },
  detector: { name: '光电探测器', domain: 'sensors', icon: 'detector', description: '接收光束并测量光功率', params: { radius: p('接收半径', .5, .1, 2, .05, 'm'), angle: p('法线角度', 0, -180, 180, 1, '°') } },
  microphone: { name: '测量麦克风', domain: 'sensors', icon: 'mic', description: '采样该位置的叠加声压', params: {} },
  probe: { name: '场强探针', domain: 'sensors', icon: 'probe', description: '测量电场与磁场幅值', params: {} }
};
Object.assign(CATALOG, {
  box:{name:'长方体',domain:'mechanics',icon:'cube',description:'可碰撞、转动与摩擦的刚体',params:{...motion,width:p('宽度 X',.7,.1,5,.1,'m'),height:p('高度 Y',.7,.1,5,.1,'m'),depth:p('深度 Z',.7,.1,5,.1,'m'),angle:p('初始转角 Z',0,-180,180,1,'°'),spin:p('初始角速度 Z',0,-20,20,.1,'rad/s'),friction:p('摩擦系数',.3,0,1,.01),restitution:p('恢复系数',.2,0,1,.01)}},
  floor_slab:{name:'地面',domain:'mechanics',icon:'ramp',description:'固定水平承托面。长宽有限，厚 0.16 m，位置为板中心；放置后替代默认无限地面。',params:{length:p('长度',8,.2,30,.1,'m'),width:p('宽度',6,.2,30,.1,'m'),friction:p('摩擦系数',.6,0,1,.01),restitution:p('恢复系数',.4,0,1,.01)}},
  ramp:{name:'可调斜面',domain:'mechanics',icon:'ramp',description:'有摩擦的固定碰撞斜面',params:{length:p('长度',4,.5,10,.1,'m'),width:p('宽度',2,.2,6,.1,'m'),angle:p('倾角',20,-75,75,1,'°'),friction:p('摩擦系数',.3,0,1,.01)}},
  rope:{name:'柔性绳索',domain:'mechanics',icon:'rope',description:'仅承受拉力的弹性绳索',refs:['a','b'],params:{restLength:p('绳长',2,.1,10,.05,'m'),stiffness:p('拉伸刚度',100,1,500,1,'N/m'),damping:p('拉伸阻尼',.5,0,5,.1,'N·s/m')}},
  rod:{name:'刚性连杆',domain:'mechanics',icon:'rod',description:'约束两端距离，可构建摆和联动',refs:['a','b'],params:{restLength:p('杆长',2,.1,10,.05,'m')}},
  damper:{name:'阻尼器',domain:'mechanics',icon:'damper',description:'两端相对速度产生阻力',refs:['a','b'],params:{damping:p('阻尼系数',1,0,10,.1,'N·s/m')}},
  force:{name:'力 / 力矩源',domain:'mechanics',icon:'force',description:'对目标刚体施加恒力与恒力矩',refs:['target'],params:{fx:p('力 X',1,-100,100,.1,'N'),fy:p('力 Y',0,-100,100,.1,'N'),fz:p('力 Z',0,-100,100,.1,'N'),tx:p('力矩 X',0,-20,20,.1,'N·m'),ty:p('力矩 Y',0,-20,20,.1,'N·m'),tz:p('力矩 Z',0,-20,20,.1,'N·m')}},
  battery:{name:'直流电源',domain:'circuit',icon:'battery',description:'带内阻的直流电压源',terminals:['a','b'],params:{voltage:p('电动势',12,-100,100,.1,'V'),resistance:p('电源内阻',.1,.01,100, .01,'Ω')}},
  resistor:{name:'电阻',domain:'circuit',icon:'resistor',description:'欧姆定律，串联与并联网络',terminals:['a','b'],params:{resistance:p('电阻',100,.01,1e7,.01,'Ω')}},
  capacitor:{name:'电容',domain:'circuit',icon:'capacitor',description:'储能与 RC 充放电暂态',terminals:['a','b'],params:{capacitance:p('电容量',1000,1,1e6,1,'μF'),initialVoltage:p('初始电压',0,-100,100,.1,'V')}},
  inductor:{name:'电感',domain:'circuit',icon:'coil',description:'储能与 RL 暂态',terminals:['a','b'],params:{inductance:p('电感量',100,.1,1e5,.1,'mH'),initialCurrent:p('初始电流',0,-20,20,.01,'A')}},
  switch:{name:'开关',domain:'circuit',icon:'switch',description:'控制电路通断',terminals:['a','b'],params:{closed:p('状态 0=断开 1=闭合',1,0,1,1)}},
  lamp:{name:'灯泡',domain:'circuit',icon:'lamp',description:'电阻负载，亮度随功率变化',terminals:['a','b'],params:{resistance:p('工作电阻',60,.1,1e5,.1,'Ω'),ratedPower:p('额定功率',2.4,.01,1000,.01,'W')}},
  voltmeter:{name:'电压表',domain:'circuit',icon:'voltmeter',description:'并联测量两端电压，内阻 10 MΩ',terminals:['a','b'],params:{}},
  ammeter:{name:'电流表',domain:'circuit',icon:'ammeter',description:'串联测量电流，内阻 1 mΩ',terminals:['a','b'],params:{}},
  ground:{name:'参考地',domain:'circuit',icon:'ground',description:'指定零电位参考节点',terminals:['a'],params:{}}
});

Object.assign(CATALOG, {
  cylinder:{name:'圆柱滚轮',domain:'mechanics',icon:'sphere',description:'具有转动惯量的圆柱，滚动、摩擦与碰撞',params:{...motion,radius:p('半径',.35,.05,2,.01,'m'),height:p('轴向长度',.6,.1,5,.1,'m'),angle:p('初始转角 Z',0,-180,180,1,'°'),spin:p('初始角速度 Z',0,-20,20,.1,'rad/s'),friction:p('摩擦系数',.4,0,1,.01),restitution:p('恢复系数',.2,0,1,.01)}},
  drag:{name:'流体阻力',domain:'mechanics',icon:'damper',description:'静止流体：F = −(b + k|v|)v，作用于目标刚体',refs:['target'],params:{linear:p('线性阻力系数',.5,0,10,.01,'kg/s'),quadratic:p('平方阻力系数',0,0,5,.01,'kg/m')}},
  expression_force:{name:'表达式力源',domain:'mechanics',icon:'force',description:'绑定刚体，按 Fx、Fy、Fz 表达式施力。变量 t,x,y,z,vx,vy,vz,speed,m,pi；支持 + - * / ^ 和 sin,cos,abs,sqrt,exp。每轴限幅 ±100 N，未定义值按 0 N。',refs:['target'],params:Object.fromEntries(['fx','fy','fz'].map((axis,i)=>[axis,{type:'expression',label:axis.toUpperCase()+' (N)',value:i===0?'sin(t)':'0'}]))},
  harmonic_force:{name:'周期驱动器',domain:'mechanics',icon:'force',description:'对刚体施加正弦力，研究受迫振动',refs:['target'],params:{amplitude:p('力幅值',1,0,100,.1,'N'),frequency:p('频率',1,0,30,.1,'Hz'),phase:p('相位',0,-180,180,1,'°'),axis:p('方向 0=X 1=Y 2=Z',0,0,2,1)}},
  dynamometer:{name:'弹簧测力计',domain:'mechanics',icon:'spring',description:'弹性两端连接，读出带符号的轴向作用力',refs:['a','b'],params:{stiffness:p('劲度系数',20,.1,200,.1,'N/m'),restLength:p('原长',1,.1,8,.05,'m'),damping:p('阻尼',.1,0,5,.01,'N·s/m')}},
  electric_field:{name:'匀强电场',domain:'electricity',icon:'charge',description:'球形作用区内对电荷施加 qE 力',params:{strength:p('电场强度',1000,-1e6,1e6,10,'N/C'),radius:p('作用区半径',3,.5,10,.1,'m'),axis:p('方向 0=X 1=Y 2=Z',0,0,2,1)}},
  bar_magnet:{name:'条形磁铁',domain:'magnetism',icon:'magnet',description:'软化磁偶极子场，远场按距离三次方衰减',params:{moment:p('磁偶极矩',1000,-1e5,1e5,10,'A·m²'),core:p('软化半径',.2,.05,2,.01,'m'),axis:p('磁矩方向 0=X 1=Y 2=Z',0,0,2,1)}},
  diverging_lens:{name:'凹透镜',domain:'optics',icon:'lens',description:'负焦距薄透镜，使光线发散',params:{focal:p('焦距',-1.5,-8,-.005,.001,'m'),radius:p('孔径半径',.7,.001,2,.001,'m'),angle:p('光轴角度',0,-180,180,1,'°')}},
  aperture:{name:'可调光阑',domain:'optics',icon:'detector',description:'通光孔径限制，遮挡环内的光线被吸收',params:{opening:p('通光孔径半径',.15,.01,2,.01,'m'),radius:p('遮挡盘半径',.8,.1,3,.05,'m'),angle:p('法线角度',0,-180,180,1,'°')}},
  optical_filter:{name:'中性密度滤光片',domain:'optics',icon:'mirror',description:'按透过率衰减入射光功率，不改变方向',params:{transmission:p('透过率',.5,0,1,.01),radius:p('有效半径',.8,.1,3,.05,'m'),angle:p('法线角度',0,-180,180,1,'°')}},
  directional_speaker:{name:'指向性声源',domain:'acoustics',icon:'sound',description:'前向余弦指向性，背向无声压贡献',params:{...CATALOG.speaker.params,angle:p('朝向角度',0,-180,180,1,'°'),directivity:p('指向性指数',2,1,8,1)}},
  rheostat:{name:'滑动变阻器',domain:'circuit',icon:'resistor',description:'两端变阻器，阻值随滑片比例变化',terminals:['a','b'],params:{resistance:p('最大阻值',1000,.01,1e7,.01,'Ω'),ratio:p('滑片比例',.5,.001,1,.001)}},
  ac_source:{name:'交流电压源',domain:'circuit',icon:'power',description:'正弦电压，支持直流偏置和源内阻',terminals:['a','b'],params:{amplitude:p('电压幅值',5,0,100,.1,'V'),frequency:p('频率',10,0,200,.1,'Hz'),phase:p('相位',0,-180,180,1,'°'),offset:p('直流偏置',0,-100,100,.1,'V'),resistance:p('源内阻',.1,.01,100,.01,'Ω')}},
  current_source:{name:'恒流源',domain:'circuit',icon:'ammeter',description:'向端子 A 输出电流，具有有限输出电阻',terminals:['a','b'],params:{current:p('输出电流',.01,-10,10,.001,'A'),resistance:p('输出电阻',1e6,1,1e7,1,'Ω')}},
  distance_sensor:{name:'测距仪',domain:'sensors',icon:'probe',description:'跟踪两个器具中心的实际距离',refs:['a','b'],params:{}},
  motion_sensor:{name:'运动传感器',domain:'sensors',icon:'probe',description:'跟踪目标位移、速度与外力加速度',refs:['target'],params:{}}
});

Object.assign(CATALOG, {
  refract_plane:{name:'折射界面',domain:'optics',icon:'mirror',description:'平面介质分界面，按斯涅尔定律折射（n₁sinθ₁ = n₂sinθ₂）',params:{angle:p('法线角度',0,-180,180,1,'°'),radius:p('界面半径',1.5,.1,5,.05,'m'),n1:p('入射侧折射率',1,1,3,.01),n2:p('折射侧折射率',1.5,1,3,.01)}},
  pinhole_screen:{name:'针孔成像装置',domain:'optics',icon:'target',description:'物体发出的光穿过小孔，在光屏上形成倒像；孔越大越亮越模糊',params:{objectHeight:p('物高',1,.05,5,.05,'m'),objectDistance:p('物距',2,.1,10,.1,'m'),holeDistance:p('孔到屏距离',1,.05,5,.05,'m'),holeDiameter:p('孔径',.005,.0001,.2,.0001,'m')}},
  eye_model:{name:'眼球模型',domain:'optics',icon:'sphere',description:'可变焦透镜 + 视网膜；模拟正常眼、近视、远视',params:{focal:p('晶状体焦距（等效）',.017,.005,.1,.001,'m'),axialLength:p('眼轴长度',.024,.015,.05,.001,'m'),objectDistance:p('物距',5,.1,100,.1,'m'),correction:p('眼镜度数',0,-20,20,.25,'D')}}
});

Object.assign(CATALOG, {
  thermometer:{name:'温度计',domain:'thermodynamics',icon:'probe',description:'测量所在位置的温度；读数按 responseTime 滞后趋近环境温度（附近的热源或导热棒优先，否则为环境温度）',params:{responseTime:p('响应时间',2,.1,120,.1,'s')}},
  heat_source:{name:'恒温热源',domain:'thermodynamics',icon:'sparkles',description:'自身温度恒定，对作用半径内的温度计与导热棒按 P = 功率·(T源−T目标)/max(d,0.1) 提供热流',params:{temperature:p('温度',100,-273,1000,1,'℃'),power:p('加热功率',50,0,10000,1,'W'),radius:p('作用半径',.5,.05,5,.01,'m')}},
  conductor:{name:'导热棒',domain:'thermodynamics',icon:'rod',description:'两端各连一个热学器具，按傅里叶定律 dQ/dt = λA(T_A−T_B)/L 传热；读数带符号，正值为 A→B',refs:['a','b'],params:{conductivity:p('导热系数',200,.01,1000,.01,'W/(m·K)'),length:p('长度',1,.05,10,.01,'m'),area:p('截面积',.01,1e-6,10,1e-4,'m²'),heatCapacity:p('热容',100,.1,100000,.1,'J/K')}},
  gas_piston:{name:'理想气体活塞缸',domain:'thermodynamics',icon:'cube',description:'可压缩理想气体模型（PV = nRT），支持调控摩尔数、体积、温度与绝热指数 γ，实时计算压强与内能',params:{moles:p('物质的量',1,.01,20,.01,'mol'),volume:p('气体体积',.024,.001,1,.001,'m³'),temperature:p('热力学温度',300,50,2000,1,'K'),gamma:p('绝热指数 γ',1.4,1.1,1.67,.01)}},
  pulley:{name:'滑轮组',domain:'mechanics',icon:'anchor',description:'定滑轮与动滑轮组合模型，实时计算拉力 F = mg/(n·η)、机械利益与绳端位移比',params:{loadMass:p('重物质量',10,.1,200,.1,'kg'),strands:p('承重绳股数 n',2,1,8,1),efficiency:p('机械效率 η',.9,.2,1,.01),gravity:p('重力加速度',9.8,1,25,.1,'m/s²')}}
});
export const SOUND_KINDS=['speaker','directional_speaker'];
export const THERMAL_KINDS=['thermometer','heat_source','conductor'];
export const LENS_KINDS=['lens','diverging_lens'];
export const RIGID_KINDS=['body','charge','box','cylinder'];
export const ENDPOINT_KINDS=[...RIGID_KINDS,'anchor'];
export const LINK_KINDS=['spring','rope','rod','damper','dynamometer'];
export const CIRCUIT_KINDS=Object.keys(CATALOG).filter(k=>CATALOG[k].terminals);
export const COUPLINGS = {
  wire: { name:'电路导线',from:CIRCUIT_KINDS,to:CIRCUIT_KINDS,description:'端子 ↔ 端子，理想导线把两端合并为一个节点' },
  electrical: { name: '电流驱动', from: ['power',...CIRCUIT_KINDS.filter(k=>k!=='ground')], to: ['coil'], description: '信号电源 / 电路支路电流 → 音圈电磁力（单向换能）' },
  acoustic: { name: '振动发声', from: [...RIGID_KINDS, 'coil'], to: SOUND_KINDS, description: '运动速度 × 增益 → 声压幅值（线性换能模型）' },
  optical: { name: '光强调制', from: [...RIGID_KINDS, 'coil'], to: ['laser'], description: '位移 × 增益 → 激光相对功率' }
};
export const uid = () => globalThis.crypto.randomUUID();
export function component(kind, overrides = {}) {
  const def = Object.hasOwn(CATALOG,kind) && CATALOG[kind];
  if (!def) throw new Error('未知器具类型：' + kind);
  return { id: uid(), kind, name: def.name, position: [0, kind==='floor_slab'?-.08:1, 0], fixed: kind==='floor_slab', params: Object.fromEntries(Object.entries(def.params).map(([k, v]) => [k, v.value])), refs: {}, ...overrides };
}
export function blankExperiment(title = '未命名实验') {
  return { id: uid(), title, goal: '', mode: '3d', components: [], connections: [], control: { running: false, reset: 0 }, environment: { gravity: 0, damping: 0, speed: 1, collisions: true, temperature: 20 }, createdAt: new Date().toISOString() };
}
export function blankWorkspace() {
  const doc = blankExperiment();
  return { version: 1, revision: 0, activeId: doc.id, experiments: [doc], designs: [], log: [], updatedAt: new Date().toISOString() };
}
export function activeExperiment(workspace) { return workspace.experiments.find(e => e.id === workspace.activeId) || workspace.experiments[0]; }
