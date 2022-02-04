import type { UUID, Position } from 'digital-fuesim-manv-shared';
import type { MapBrowserEvent } from 'ol';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import type OlMap from 'ol/Map';
import { Subject } from 'rxjs';
import type { ComponentType } from '@angular/cdk/portal';
import { MovementAnimator } from '../utility/movement-animator';
import { TranslateHelper } from '../utility/translate-helper';
import { ImageStyleHelper } from '../utility/get-image-style-function';
import { calculatePopupPositioning } from '../utility/calculate-popup-positioning';
import type {
    OpenPopupOptions,
    PopupComponent,
} from '../utility/popup-manager';
import { FeatureManager } from './feature-manager';

type ElementFeature = Feature<Point>;
type SupportedChangeProperties = ReadonlySet<'position'>;

/**
 * Bundles common functionality for multiple feature managers:
 * * moveable element
 * * popup on click
 * * image as style
 * TODO: it is expected that in the future less and less functionality will be the same for the different feature managers as they get more customized.
 * - Do not try to make this a class with a monster API. Instead let the classes not extend from this class.
 * Find a good solution/compromise between composition, inheritance (there is no multi-inheritance in JS, but you can overwrite methods and call the previous one via `super.foo()`), decorators and mixins.
 */
export abstract class CommonFeatureManager<
    Element extends Readonly<{ id: UUID; position: Position }>,
    ElementPopupComponent extends PopupComponent | undefined = undefined
> extends FeatureManager<Element, ElementFeature, SupportedChangeProperties> {
    private readonly movementAnimator = new MovementAnimator(
        this.olMap,
        this.layer
    );
    private readonly translateHelper = new TranslateHelper();
    private readonly imageStyleHelper = new ImageStyleHelper(
        this.imageOptions.imageUrl,
        this.imageOptions.imageHeight,
        true
    );
    /**
     * When this method emits a popup should be shown.
     */
    public readonly openPopup$ = new Subject<
        // TODO: this is expected only toi emit if ElementPopupComponent is defined
        OpenPopupOptions<any>
    >();

    constructor(
        private readonly olMap: OlMap,
        private readonly layer: VectorLayer<VectorSource<Point>>,
        private readonly imageOptions: {
            /**
             * The height of the image in pixels that should be used at {@link ImageStyleHelper.normalZoom} zoom
             */
            imageHeight: number;
            imageUrl: string;
        },
        private readonly proposeMovementAction: (
            newPosition: Position,
            element: Element
        ) => void,
        // TODO: this is just temporary, until we refactor the feature manager classes
        private readonly popoverOptions?: ElementPopupComponent extends PopupComponent
            ? {
                  component: ComponentType<ElementPopupComponent>;
                  height: number;
                  width: number;
                  getContext: (feature: ElementFeature) => any;
              }
            : undefined
    ) {
        super();
        this.layer.setStyle((feature, resolution) =>
            this.imageStyleHelper.getStyle(
                feature as ElementFeature,
                resolution
            )
        );
    }

    createFeature(element: Element): void {
        const elementFeature = new Feature(
            new Point([element.position.x, element.position.y])
        );
        elementFeature.setId(element.id);
        this.layer.getSource().addFeature(elementFeature);
        this.translateHelper.onTranslateEnd(elementFeature, (newPosition) => {
            this.proposeMovementAction(newPosition, element);
        });
    }

    deleteFeature(element: Element, elementFeature: ElementFeature): void {
        this.layer.getSource().removeFeature(elementFeature);
        this.movementAnimator.stopMovementAnimation(elementFeature);
    }

    readonly supportedChangeProperties = new Set(['position'] as const);
    changeFeature(
        oldElement: Element,
        newElement: Element,
        changedProperties: SupportedChangeProperties,
        patientFeature: ElementFeature
    ): void {
        if (changedProperties.has('position')) {
            this.movementAnimator.animateFeatureMovement(patientFeature, [
                newElement.position.x,
                newElement.position.y,
            ]);
        }
    }

    getElementFeature(element: Element) {
        return this.layer.getSource().getFeatureById(element.id) as
            | ElementFeature
            | undefined;
    }

    /**
     * This method is called when the user clicks on a feature on this layer.
     * @param feature The feature that was clicked on
     */
    public onFeatureClicked(
        event: MapBrowserEvent<any>,
        feature: ElementFeature
    ): void {
        if (!this.popoverOptions) {
            return;
        }
        const featureCenter = feature.getGeometry()!.getCoordinates();
        const view = this.olMap.getView();
        const zoom = view.getZoom()!;
        const { position, positioning } = calculatePopupPositioning(
            featureCenter,
            {
                // TODO: reuse the image constraints
                width: this.popoverOptions.width / zoom,
                height: this.popoverOptions.height / zoom,
            },
            view.getCenter()!
        );
        this.openPopup$.next({
            position,
            positioning,
            component: this.popoverOptions.component as any,
            context: this.popoverOptions.getContext(feature),
        });
    }
}
