/**
 * Unique simplified Hanzi encountered in the HSK 1 (2.0) vocabulary list,
 * selected by the list's word order and first occurrence within each word,
 * stored in ascending RSH frame order.
 */
export const HSK_1_2_0_CHARACTERS = [...'一二三四五六七八九十月朋明中上下儿几见的工有飞子了女好小少大多名太水时点里同字机本桌狗先个茶现钟车前客高亮京学觉识话语钱是衣师雨天商北些吃说她起家样谁午习国回店想看我打热开在友汉欢对没后菜爱么去会出岁分和米来人认你什做住他坐喝买读年呢视果听怎昨作不杯号谢老写校院系服冷喜很饭脑叫请生星睡今东西漂们候块医影这爸期姐再都书气面兴妈吗能关那哪电椅猫苹租喂']

/**
 * First 46 new unique Hanzi from HSK 2 (2.0), selected by the same vocabulary-list
 * rule and stored in ascending RSH frame order. Together with HSK 1 this fills all
 * 220 garden beds one character per bed.
 */
export const HSK_2_2_0_SUPPLEMENT_CHARACTERS = [...'唱白百员哥黑告球过比歌次到公常别务得等从房诉错还弟第给红报篮馆孩间非懂吧贵助共纸帮司汽穿长宾']

export const HSK1_VARIANT_CHARACTERS = [...'一二三四五六七八九十月朋明唱白百中上下员儿几见的工有哥飞子了女好小少大多名太水时点里黑同字机本桌狗告先个茶球现钟过车前客高亮京学觉识话语钱是衣师雨天商北比些吃歌次说她起家样谁午习国回店想看我打热开在友汉欢对没后菜爱么去会到出岁分公常别务得和米来等人认你什做住他从坐喝买读年呢房视果听诉怎昨作错不杯还弟第号谢老写校院给红系服报冷喜篮很饭馆脑叫孩请生星睡今东西漂们间非候块懂医影这爸吧期贵姐助共再纸都帮司书气汽面穿长兴妈吗能关那哪电椅猫宾苹租喂']

if (HSK_1_2_0_CHARACTERS.length !== 174) {
  throw new Error('HSK 1 (2.0) must contain 174 unique Hanzi')
}
if (HSK1_VARIANT_CHARACTERS.length !== 220 || new Set(HSK1_VARIANT_CHARACTERS).size !== 220) {
  throw new Error('Hanzi Garden HSK 1 must contain exactly 220 unique Hanzi')
}
