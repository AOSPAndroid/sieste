"use client";
import {useId} from 'react';
import {Field,FieldDescription,FieldGroup,FieldLabel} from '@/components/ui/field';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {shareFonts,type ShareFontFace} from './share-fonts';

export default function ShareFontPicker({value,onChange}:{value?:ShareFontFace;onChange:(face:ShareFontFace|undefined)=>void}){
 const id=useId();
 return <FieldGroup><Field><FieldLabel htmlFor={id}>Font</FieldLabel><NativeSelect id={id} aria-label="Share font" value={value??'auto'} onChange={event=>onChange(event.target.value==='auto'?undefined:event.target.value as ShareFontFace)} className="w-full">{shareFonts.map(font=><NativeSelectOption key={font.key} value={font.key}>{font.name}</NativeSelectOption>)}</NativeSelect><FieldDescription>{shareFonts.find(font=>font.key===(value??'auto'))?.description}. Applies to numbers and lettering.</FieldDescription></Field></FieldGroup>;
}
