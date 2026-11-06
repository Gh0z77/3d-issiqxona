import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/** Faqat kuchli videokartada: ambient occlusion + yengil bloom. Alohida paket — kuchsiz qurilma yuklamaydi. */
export default function Post() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={1.2} distanceFalloff={0.8} intensity={1.6} quality="medium" halfRes />
      <Bloom mipmapBlur intensity={0.25} luminanceThreshold={1.2} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
