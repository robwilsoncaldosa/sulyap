import type { ComponentProps } from "react";
import type { Dress } from "../../domain/rental";

type DressImageProps = Omit<ComponentProps<"img">, "src" | "srcSet"> & {
  dress: Dress;
};

export function DressImage({
  dress,
  sizes,
  width = 1024,
  height = 1536,
  ...props
}: DressImageProps) {
  const display = dress.image
    .replace("/images/", "/images/display/")
    .replace(".png", "");
  return (
    <img
      src={`${display}-640.webp`}
      srcSet={[320, 640, 960].map((size) => `${display}-${size}.webp ${size}w`).join(", ")}
      sizes={sizes ?? "(max-width: 480px) calc(100vw - 36px), (max-width: 760px) calc(50vw - 30px), (max-width: 1100px) calc((100vw - 112px) / 3), 380px"}
      width={width}
      height={height}
      {...props}
    />
  );
}
