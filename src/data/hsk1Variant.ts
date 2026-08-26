/**
 * Unique simplified Hanzi encountered in the HSK 1 (2.0) vocabulary list,
 * preserving the list's word order and first occurrence within each word.
 */
export const HSK_1_2_0_CHARACTERS = [...'爱八爸杯子北京本不客气菜茶吃出租车打电话大的点脑视影东西都读对起多少儿二饭店飞机分钟高兴个工作狗汉语好号喝和很后面回会几家叫今天九开看见块来老师了冷里六妈吗买猫没关系有米名字明哪那呢能你年女朋友漂亮苹果七前钱请去热人认识三商上午谁什么十时候是书水睡觉说四岁他她太听同学喂我们五喜欢下雨先生现在想小姐些写谢星期习校一衣服医院椅月再怎样这中国住桌昨坐做']

/**
 * First 46 new unique Hanzi from HSK 2 (2.0), using the same ordering rule.
 * Together with HSK 1 this fills all 220 garden beds one character per bed.
 */
export const HSK_2_2_0_SUPPLEMENT_CHARACTERS = [...'吧白百帮助报纸比别宾馆长唱歌穿次从错篮球到得等弟第懂房间非常务员告诉哥给公共汽司贵过还孩黑红']

export const HSK1_VARIANT_CHARACTERS = [
  ...HSK_1_2_0_CHARACTERS,
  ...HSK_2_2_0_SUPPLEMENT_CHARACTERS,
]

if (HSK_1_2_0_CHARACTERS.length !== 174) {
  throw new Error('HSK 1 (2.0) must contain 174 unique Hanzi')
}
if (HSK1_VARIANT_CHARACTERS.length !== 220 || new Set(HSK1_VARIANT_CHARACTERS).size !== 220) {
  throw new Error('Hanzi Garden HSK 1 must contain exactly 220 unique Hanzi')
}
